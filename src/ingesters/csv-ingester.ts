import { IInfluxClientConfig, InfluxClient } from "../clients"
import * as fs from "fs"
import { CsvQuery } from "./ingester"
import { mapToPointFactory } from "./map-to-point"
import { EventEmitter } from "events"
import * as readline from "readline"

export interface CsvIngesterProgressEvent {
  totalPoints: number
}

export class CsvIngester {

  private readonly events = new EventEmitter()

  private constructor(private readonly influxClient: InfluxClient) {}

  onProgress(callback: (processEvent: CsvIngesterProgressEvent) => void): this {
    this.events.on("progress", callback)
    return this
  }

  async ingest({ filename, measurement, mappings, parseLine }: CsvQuery): Promise<void> {
    const mapToPoint = mapToPointFactory(measurement, mappings)

    let totalPoints = 0

    await this.processFile(filename, parseLine, (values, columns) => {
      let result = columns.reduce((acc, it, i) => {
        acc[it] = values[i]
        return acc
      }, {} as any)

      this.influxClient.writeOne(mapToPoint(result))

      totalPoints++

      if (totalPoints % 10000 === 0) {
        this.events.emit("progress", { totalPoints } as CsvIngesterProgressEvent)
      }

    })
  }

  private async processFile(
    filename: string,
    parseLine: (line: string) => string[],
    processValues: (values: string[], columns: string[]) => void,
  ) {
    let columns: string[] | undefined

    const fileStream = fs.createReadStream(filename)

    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    })

    for await (const line of rl) {
      if (!columns) {
        columns = parseLine(line)
        continue
      }

      processValues(parseLine(line), columns)
    }
  }

  destroy() {
    this.influxClient.destroy()
    this.events.removeAllListeners()
  }

  static async create({ influx }: { influx: IInfluxClientConfig }) {
    const influxClient = await InfluxClient.createClient(influx)

    return new CsvIngester(influxClient)
  }
}
