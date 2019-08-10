import { Duration, Moment } from "moment"
import { Mapping } from "./map-to-point"

export interface CsvQuery {
  /**
   * filename to load the csv data from
   */
  filename: string
  /**
   * mappings describing how to process each line of the csv data into a point to transmit to influxdb
   */
  mappings: Mapping[]
  /**
   * the name of the measurement to record points to in influxdb
   */
  measurement: string
  /**
   * function to parse each line of csv data into an array of strings. Eg:
   * `(line: string) => line.split(",")`
   * @param line
   */
  parseLine: (line: string) => string[]
}

export interface SplunkQuery {
  /**
   * the search query to run on splunk, Eg:
   * `index=* message="request complete" elapsed != null`
   */
  query: string
  /**
   * mappings describing how to process each line of the csv data into a point to transmit to influxdb
   */
  mappings: Mapping[]
  /**
   * the name of the measurement to record points to in influxdb
   */
  measurement: string
}

export interface SplunkTimeRangeQuery extends SplunkQuery {
  /**
   * the value to become the `earliest_time` when running the searches on splunk
   */
  from: Moment,
  /**
   * the value to become the last `latest_time` when running the searches on splunk
   */
  to: Moment,
  /**
   * the width / length of each individual search to run on splunk, eg: a duration of 1 hour, will
   * cause the total window to be searched in increments of 1 hour.
   */
  stepSize: Duration
}

