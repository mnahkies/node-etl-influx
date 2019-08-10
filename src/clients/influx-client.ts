import { InfluxDB, IPoint, ISingleHostConfig } from "influx"

export type IInfluxClientConfig = ISingleHostConfig

export class InfluxClient {

  private batch: IPoint[] = []
  private maxBatchSize = 10000
  private flushIntervalMs = 1000

  private flushInterval: any

  private constructor(
    private readonly client: InfluxDB,
  ) {
    this.flushInterval = setInterval(() => this.flush(), this.flushIntervalMs)
  }

  destroy() {
    clearInterval(this.flushInterval)
  }

  flush() {
    if (this.batch.length === 0) {
      return
    }

    this.client.writePoints(this.batch)
      .catch(err => {
        console.error("error flushing metrics", err)
      })

    this.batch = []
  }

  writeOne(point?: IPoint) {
    if (!point) {
      return
    }

    this.batch.push(point)

    if (this.batch.length > this.maxBatchSize) {
      this.flush()
    }
  }

  static async createClient(config: IInfluxClientConfig) {
    const client = new InfluxDB(config)

    await client.ping(5 * 1000)

    return new InfluxClient(client)
  }
}
