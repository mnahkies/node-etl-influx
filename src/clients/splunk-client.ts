import { Moment } from "moment"

const splunkjs = require("splunk-sdk")

export interface ISplunkClientConfig {
  host: string
  username: string
  password: string
}

export class SplunkClient {
  private constructor(private readonly service: any) {}

  async queryTimeRange(query: string, columns: string[], from: Moment, to: Moment, processResults: (results: any[]) => void): Promise<void> {
    query = `search ${ query } | table ${ columns.join(", ") }`

    const job = await this.runBlockingSearch(query, {
      exec_mode: "blocking",
      earliest_time: from.toISOString(),
      latest_time: to.toISOString(),
      count: 0,
    })

    const resultCount = job.properties().resultCount
    let offset = 0
    let count = 50000

    console.info("job returned " + resultCount + " results")

    while (offset < resultCount) {
      let results = await this.queryResultsFromJob(job, offset, count)
      processResults(this.resultsToResultArray(results, columns))
      offset += count
    }
  }

  private async runBlockingSearch(query: string, params: any) {
    return new Promise<any>((resolve, reject) => {
      this.service.search(query, params, (err: Error | null, job: any) => {

        if (err) {
          return reject(err)
        }

        job.fetch((err?: Error) => {
          if (err) {
            return reject(err)
          }

          resolve(job)
        })
      })
    })
  }

  createRealTimeSearchJob(query: string, columns: string[]) {
    return new Promise((resolve, reject) => {
      query = `search ${ query } | table ${ columns.join(", ") }`

      this.service.search(query, { earliest_time: "rt", latest_time: "rt" }, (err: Error | null, job: any) => {
        err ? reject(err) : resolve(job)
      })

    })
  }

  queryNextResults(job: any, columns: string[]): Promise<{ [key: string]: string }[]> {
    return new Promise((resolve, reject) => {
      job.preview({}, (err: Error | null, results: { fields: string[], rows: any[] }) => {
        if (err) {
          return reject(err)
        }

        resolve(this.resultsToResultArray(results, columns))
      })
    })
  }

  cancelJob(job: any) {
    job.cancel(job)
  }

  private async queryResultsFromJob(job: any, offset: number, count: number): Promise<any> {
    return new Promise((resolve, reject) => {
      job.results({ count, offset }, (err: Error | null, results: any) => {
        err ? reject(err) : resolve(results)
      })
    })
  }

  private resultsToResultArray(results: { fields: string[], rows: any[] }, extractFields: string[]) {
    const mappings = extractFields
      .map(it => {
        return { name: it, index: results.fields.indexOf(it) }
      })
      .filter(it => it.index !== -1)

    return results.rows.map(row => {
      return mappings.reduce((acc, mapping) => {
        acc[mapping.name] = row[mapping.index]

        return acc
      }, {} as any)
    })
  }

  static async create(config: ISplunkClientConfig) {
    const service = new splunkjs.Service(config)

    await new Promise((resolve, reject) => {
      service.login(function (err?: Error) {
        if (err) {
          return reject(err)
        }
        resolve()
      })
    })

    return new SplunkClient(service)
  }

}
