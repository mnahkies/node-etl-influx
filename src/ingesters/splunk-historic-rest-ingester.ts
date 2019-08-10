import { IInfluxClientConfig, InfluxClient, ISplunkClientConfig, SplunkClient } from "../clients"
import { SplunkTimeRangeQuery } from "./ingester"
import { mapToPointFactory } from "./map-to-point"
import { Moment } from "moment"
import { EventEmitter } from "events"

export interface SplunkHistoricRestIngesterProgressEvent {
  totalPoints: number
  lastFrom: Moment
  lastTo: Moment
}

export class SplunkHistoricRestIngester {

  private readonly events = new EventEmitter()

  private constructor(
    private readonly influxClient: InfluxClient,
    private readonly splunkClient: SplunkClient,
  ) {}

  onProgress(callback: (processEvent: SplunkHistoricRestIngesterProgressEvent) => void): this {
    this.events.on("progress", callback)
    return this
  }

  async ingest({ from, to, stepSize, query, mappings, measurement }: SplunkTimeRangeQuery) {
    let totalPoints = 0
    from = from.clone()
    to = to.clone()

    const columns = mappings.map(it => it.from)
    const mapToPoint = mapToPointFactory(measurement, mappings)

    while (from.isBefore(to)) {
      const next = from.clone().add(stepSize)

      await this.splunkClient.queryTimeRange(query, columns, from, next, (results) => {
        totalPoints += results.length

        results.map(mapToPoint).forEach(it => this.influxClient.writeOne(it))

        this.events.emit("progress", {
          totalPoints,
          lastFrom: from,
          lastTo: next,
        } as SplunkHistoricRestIngesterProgressEvent)
      })

      from = next
    }

    this.influxClient.flush()
  }

  destroy() {
    this.influxClient.destroy()
    this.events.removeAllListeners()
  }

  static async create({ splunk, influx }: { splunk: ISplunkClientConfig, influx: IInfluxClientConfig }): Promise<SplunkHistoricRestIngester> {
    const influxClient = await InfluxClient.createClient(influx)
    const splunkClient = await SplunkClient.create(splunk)

    return new SplunkHistoricRestIngester(influxClient, splunkClient)
  }
}
