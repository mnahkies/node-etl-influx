import { IInfluxClientConfig, InfluxClient, ISplunkClientConfig, SplunkClient } from "../clients"
import { SplunkQuery } from "./ingester"
import { mapToPointFactory } from "./map-to-point"

export class SplunkRealTimeRestIngester {

  private constructor(
    private readonly influxClient: InfluxClient,
    private readonly splunkClient: SplunkClient,
  ) {}

  async ingest({ query, measurement, mappings }: SplunkQuery) {
    const columns = mappings.map(it => it.from)
    const mapToPoint = mapToPointFactory(measurement, mappings)

    const job = await this.splunkClient.createRealTimeSearchJob(query, columns)

    const timer = setInterval(() => {
      this.splunkClient.queryNextResults(job, columns)
        .then((results) => {
          results.map(mapToPoint).forEach(it => this.influxClient.writeOne(it))
        })
    }, 1000)

    await this.blockUntilUserHalts()

    clearInterval(timer)
    await this.splunkClient.cancelJob(job)
  }

  private async blockUntilUserHalts() {
    return new Promise((resolve) => {
      const readline = require("readline").createInterface({
        input: process.stdin,
        output: process.stdout,
      })

      prompt()

      function prompt() {
        readline.question(`Halt?`, (answer: string) => {
          if (answer === "yes") {
            readline.close()
            resolve()
          }
        })
      }
    })

  }

  destroy() {
    this.influxClient.destroy()
  }

  static async create({ splunk, influx }: { splunk: ISplunkClientConfig, influx: IInfluxClientConfig }): Promise<SplunkRealTimeRestIngester> {
    const influxClient = await InfluxClient.createClient(influx)
    const splunkClient = await SplunkClient.create(splunk)

    return new SplunkRealTimeRestIngester(influxClient, splunkClient)
  }
}
