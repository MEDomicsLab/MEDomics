/* eslint-disable camelcase */
import { randomUUID } from "crypto"
import * as d3 from "d3"
import * as dfd from "../../../utilities/danfo.js"
import * as echarts from "echarts"
import ReactECharts from "echarts-for-react"
import { Button } from "primereact/button"
import { Checkbox } from "primereact/checkbox"
import { confirmDialog } from "primereact/confirmdialog"
import { Dropdown } from "primereact/dropdown"
import { MultiSelect } from "primereact/multiselect"
import { ToggleButton } from "primereact/togglebutton"
import React from "react"
import { Col, Row, Spinner } from "react-bootstrap"
import { XSquare } from "react-bootstrap-icons"
import { toast } from "react-toastify"
import { createFolderFromPath } from "../../../utilities/fileManagementUtils"
import { deepCopy } from "../../../utilities/staticFunctions"
import { connectToMongoDB, insertMEDDataObjectIfNotExists } from "../../mongoDB/mongoDBUtils"
import { MEDDataObject } from "../../workspace/NewMedDataObject"
import { getPathSeparator } from "../../../utilities/fileManagementUtils"

/**
 * @class MEDcohortFigureClass
 * @category Components
 * @classdesc Class component that renders a figure of the MEDcohort data.
 * @param {Object} props
 * @param {String} props.jsonID - Path to the MEDcohort json file.
 * @param {Object} props.jsonDataIsLoaded - If MEDcohort json data is loaded. Spinner is showed by the parent component.
 */
class MEDcohortFigureClass extends React.Component {
  /**
   * @constructor
   * @property {Object} this.state - Component state.
   * @property {Object} this.state.jsonData - MEDcohort json data.
   * @property {String} this.state.classes - Classes to be displayed in the figure.
   * @property {String} this.state.relativeTime - Class to be used as relative time.
   * @property {Boolean} this.state.separateVertically - If true, the classes will be separated vertically.
   * @property {Boolean} this.state.separateHorizontally - If true, the classes will be separated horizontally.
   * @property {Boolean} this.state.selectedClassesToSetTimePoint - Classes to be used to set the time point.
   * @property {Boolean} this.state.shapes - Shapes to be displayed in the figure.
   * @property {Boolean} this.state.timePoints - Time points to be displayed in the figure.
   * @property {Boolean} this.state.timePoint - Time point to be displayed in the figure.
   * @property {Boolean} this.state.selectedData - Selected data to be displayed in the figure.
   * @property {Boolean} this.state.timePointClusters - Time point clusters to be displayed in the figure.
   * @property {Boolean} this.state.echartsOptions - Echarts options to be displayed in the figure.
   * @property {Boolean} this.state.layout - Layout to be displayed in the figure.
   * @property {Boolean} this.state.darkMode - If true, the figure will be displayed in dark mode.
   * @property {Boolean} this.state.mergeTimePoints - If true, the time points will be merged.
   * @property {String} this.state.selectedMergingMethod - Method to be used to merge the time points.
   */
  constructor(props) {
    super(props)
    this.state = {
      jsonData: this.props.jsonData,
      selectedClass: undefined,
      relativeTime: null,
      annotations: [],
      separateVertically: false,
      separateHorizontally: false,
      selectedClassesToSetTimePoint: null,
      shapes: [],
      timePoints: [{ label: "1", value: 1 }],
      timePoint: 1,
      selectedData: [],
      timePointClusters: [],
      echartsOptions: null,
      classes: new Set(),
      darkMode: false,
      isWorking: false,
      mergeTimePoints: false,
      selectedMergingMethod: "mean"
    }
    this.chartRef = React.createRef()
  }

  mergingMethodsOptions = [
    { label: "Mean", value: "mean" },
    { label: "Median", value: "median" },
    { label: "Min", value: "min" },
    { label: "Max", value: "max" },
    { label: "Sum", value: "sum" },
    { label: "First", value: "first" },
    { label: "Last", value: "last" },
    { label: "Mode", value: "mode" }
  ]

  /**
   * Invoked immediately after a component is mounted
   * Sets the jsonData state by loading the JSON file at the specified path and generates Echarts options.
   * @function
   * @returns {void}
   */
  async componentDidMount() {
    // Connect to mongDB
    const db = await connectToMongoDB()

    // Load the JSON data from GridFS
    const { GridFSBucket } = require("mongodb")
    const gridFSBucket = new GridFSBucket(db)

    // Find the file in GridFS and get its _id
    const filesCursor = gridFSBucket.find({ filename: "MEDprofiles.json" })
    const file = await filesCursor.next() // Get the first matching file (if it exists)

    if (!file) {
      console.error("File 'MEDprofiles.json' not found in GridFS")
      return
    }

    // Open a readable stream to retrieve the JSON data
    const stream = gridFSBucket.openDownloadStreamByName("MEDprofiles.json")

    let jsonData = ""

    // Collect data from stream
    stream.on("data", (chunk) => {
      jsonData += chunk.toString()
    })

    // On the end of the stream, update the state
    stream.on("end", async () => {
      try {
        const parsedData = JSON.parse(jsonData)
        console.log("componentDidMount parsedData", parsedData)

        // Update the state with the loaded JSON data
        this.setState({ jsonData: parsedData }, () => {
          this.generateEchartsOptions() // Call the chart generation method
          this.props.setJsonDataIsLoaded(true) // Notify that the data is loaded
        })
      } catch (error) {
        console.error("Error parsing JSON data from GridFS:", error)
      }
    })

    stream.on("error", (err) => {
      console.error("Error loading data from GridFS:", err)
    })

    this.setState({ darkMode: window.matchMedia("(prefers-color-scheme)").matches ? "dark" : "light" }) // Set the initial theme type
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
      if (e.matches) {
        this.setState({ darkMode: true })
      } else {
        this.setState({ darkMode: false })
      }
    })
  }

  /**
   * Invoked immediately before a component is unmounted and destroyed.
   * @function
   * @returns {void}
   * @desc Removes the event listener for the dark mode.
   */
  componentWillUnmount() {
    window.matchMedia("(prefers-color-scheme)").removeEventListener("change", () => {})
  }

  /**
   * @desc React lifecycle method that is called after the component updates. It is used to respond to changes in props or state.
   * @param {object} prevProps - The previous props object.
   * @param {object} prevState - The previous state object.
   * @returns {void}
   */
  componentDidUpdate(prevProps, prevState) {
    // eslint-disable-next-line no-undef
    echarts.registerTheme("dark", require("../../../styles/input/medCohortFigureDark.json"))

    // Respond to changes in props or state
    if (prevProps.jsonData !== this.props.jsonData) {
      this.setState({ jsonData: this.props.jsonData }, () => {
        this.generateEchartsOptions()
      })
    } else if (prevState.jsonData !== this.state.jsonData) {
      this.generateEchartsOptions()
    } else if (prevState.separateHorizontally !== this.state.separateHorizontally || prevState.separateVertically !== this.state.separateVertically) {
      this.generateEchartsOptions()
    } else if (prevState.relativeTime !== this.state.relativeTime) {
      this.generateEchartsOptions()
    } else if (prevState.darkMode !== this.state.darkMode) {
      this.generateEchartsOptions()
    } else if (prevProps.isExporting !== this.props.isExporting) {
      this.setState({ isWorking: this.props.isExporting })
    }
  }

  /**
   * Returns a color from the Turbo color scheme based on the index in a list.
   * @param {number} index - The index of the color in the list.
   * @param {number} length - The length of the list.
   * @returns {string} - The color in hexadecimal format.
   */
  returnTurboColorFromIndexInList = (index, length) => {
    return d3.interpolateTurbo(index / length)
  }

  /**
   * Creates a rectangle from a given time point, length, time point clusters, echarts options, and name.
   * @param {number} timePoint - The time point to create the rectangle from.
   * @param {number} length - The length of the rectangle.
   * @param {Object} timePointClusters - The time point clusters.
   * @param {Object} echartsOptions - The echarts options.
   * @param {string} name - The name of the rectangle.
   * @returns {Object} - The rectangle object.
   */
  createRectFromTimePoint = (timePoint, length, timePointClusters, echartsOptions, name) => {
    /**
     * Finds the earliest date in a given time point.
     * @param {number} timePoint - The time point to find the earliest date from.
     * @returns {Date} - The earliest date.
     */
    const findEarliestDate = (timePoint) => {
      let earliestDate = null
      timePointClusters[timePoint].x.forEach((x) => {
        if (earliestDate === null) {
          earliestDate = x
        } else if (x < earliestDate) {
          earliestDate = x
        }
      })
      return earliestDate
    }
    /**
     * Finds the latest date in a given time point.
     * @param {number} timePoint - The time point to find the latest date from.
     * @returns {Date} - The latest date.
     */
    const findLatestDate = (timePoint) => {
      let latestDate = new Date(0)
      timePointClusters[timePoint].x.forEach((x) => {
        if (x > latestDate) {
          latestDate = x
        }
      })
      return latestDate
    }

    let earliestDate = findEarliestDate(timePoint)
    let latestDate = findLatestDate(timePoint)
    if (this.state.relativeTime !== null) {
      earliestDate = earliestDate.valueOf() / (1000 * 60 * 60 * 24)
      latestDate = latestDate.valueOf() / (1000 * 60 * 60 * 24)
    }
    let rect = {
      name: `T${name}`,
      type: "scatter",

      markArea: {
        silent: true,
        itemStyle: {
          color: this.returnTurboColorFromIndexInList(timePoint, 5),
          opacity: 0.1,
          borderWidth: 1,
          borderType: "dashed"
        },
        label: {
          position: "bottom",
          show: true,
          formatter: `T${name}`
        },
        data: [
          [
            {
              name: `T${name}`,
              xAxis: earliestDate,
              yAxis: -1
            },
            {
              xAxis: latestDate,
              yAxis: echartsOptions.yAxis[0].data.length
            }
          ]
        ]
      },
      data: [
        [earliestDate, -1],
        [latestDate, echartsOptions.yAxis[0].data.length]
      ]
    }
    return rect
  }

  /**
   * Updates the time point clusters and echarts options, and updates the state with new time points and shapes.
   * @param {Array} timePointClusters - An array of time point clusters.
   * @param {Object} echartsOptions - The echarts options object.
   * @returns {void}
   */
  handleTimePointClustersChange = (timePointClusters, echartsOptions) => {
    let newShapes = []
    let length = timePointClusters.length
    timePointClusters.forEach((cluster, index) => {
      let rect = this.createRectFromTimePoint(index, length, timePointClusters, echartsOptions, cluster.name)
      newShapes.push(rect)
    })

    let newTimePoints = this.updateTimePoints(timePointClusters)
    if (newTimePoints.length === timePointClusters.length) {
      // Get last time point
      let lastElement = newTimePoints[newTimePoints.length - 1]
      let lastTimePoint = lastElement.value

      this.range(lastTimePoint, 1).forEach((timePoint) => {
        if (newTimePoints.findIndex((element) => element.value === timePoint) === -1) {
          newTimePoints.push({ label: timePoint, value: timePoint })
        }
      })
      if (newTimePoints.length !== 1 + timePointClusters.length) {
        // Add the future time point
        newTimePoints.push({ label: lastTimePoint + 1, value: lastTimePoint + 1 })
      }
    }
    newTimePoints.sort((a, b) => (a.value > b.value ? 1 : -1))
    this.setState({ timePoint: newTimePoints[newTimePoints.length - 1]["value"], timePoints: newTimePoints, shapes: newShapes })
  }

  /**
   * Returns an array of numbers from startAt to startAt + size - 1.
   * @param {number} size - The size of the array to be returned.
   * @param {number} startAt - The starting number of the array.
   * @returns {number[]} - An array of numbers from startAt to startAt + size - 1.
   */
  range(size, startAt) {
    return [...Array(size).keys()].map((i) => i + startAt)
  }

  /**
   * Updates the time points based on the given time point clusters.
   * @param {Array} timePointClusters - An array of time point clusters.
   * @returns {Array} An array of objects containing label and value properties for each time point.
   */
  updateTimePoints = (timePointClusters) => {
    let newTimePoints = new Set([1])
    timePointClusters.forEach((cluster) => {
      newTimePoints.add(cluster.name)
    })
    let newTimePointsArray = []
    newTimePoints.forEach((timePoint) => {
      newTimePointsArray.push({ label: timePoint, value: timePoint })
    })
    return newTimePointsArray
  }

  /**
   *
   * @param {MEDprofiles.list_MEDtab.MEDtab} tabObject
   * @param {String} className
   * @returns {boolean}
   *
   * @description
   * This functions returns true if the className attribute in MEDtab object is not null.
   */
  isNotNull(tabObject, className) {
    let attributes = Object.keys(tabObject[className])
    let toRet = false
    attributes.forEach((attribute) => {
      if (tabObject[className][attribute] !== null) {
        toRet = true
      }
    })
    return toRet
  }

  /**
   * Gets the time zero for a given class name and profile index.
   * @param {String} className - The class name to get the time zero for.
   * @param {number} profileIndex - The profile index to get the time zero for.
   * @returns {Date} The time zero for the given class name and profile index.
   */
  getTimeZeroForClass = (className, profileIndex) => {
    let timeZeroAttribute = null
    if (className === null) return null
    this.state.jsonData?.list_MEDprofile[profileIndex]?.list_MEDtab?.forEach((tab) => {
      let attributes = Object.keys(tab)
      let attributeIndex = attributes.indexOf(className)
      if (attributeIndex !== -1) {
        let attribute = attributes[attributeIndex]
        if (attribute !== "Date" && attribute !== "Time_point" && this.isNotNull(tab, attribute)) {
          if (attribute === this.state.relativeTime && timeZeroAttribute === null && tab.Date !== null) {
            return (timeZeroAttribute = tab.Date)
          }
        }
      } else {
        console.log("Attribute not found", className, attributes)
      }
    })
    return timeZeroAttribute
  }

  /**
   * Sets the time point for selected classes in the jsonData object.
   * @function
   * @returns {void}
   */
  handleSetTimePointByClass = () => {
    let newJsonData = { ...this.state.jsonData }
    newJsonData.list_MEDprofile.forEach((profile) => {
      profile.list_MEDtab.forEach((tab) => {
        if (tab.Date !== null) {
          let attributes = Object.keys(tab)
          attributes.forEach((attribute) => {
            if (attribute !== "Date" && attribute !== "Time_point" && this.isNotNull(tab, attribute)) {
              if (this.state.selectedClassesToSetTimePoint.includes(attribute)) {
                if (tab.Time_point === null) {
                  tab.Time_point = [this.state.timePoint]
                } else {
                  tab.Time_point.push(this.state.timePoint)
                }
              }
            }
          })
        }
      })
    })
    this.setState({ jsonData: newJsonData })
  }

  /**
   * Generates the options for the ECharts visualization.
   * @returns {void}
   */
  generateEchartsOptions = () => {
    // Create a new ECharts option object
    let newEchartsOption = {
      // Set the title of the chart
      title: {
        text: "MEDcohort",
        subtext: "MEDcohort visualization",
        left: "center"
      },
      // Set the tooltip trigger
      tooltip: {
        trigger: "item"
      },
      // Set the grid layout
      grid: {
        left: "3%",
        right: "120",
        bottom: "70",
        containLabel: true
      },
      // Set the x-axis type based on the relativeTime state
      xAxis: [
        {
          name: (this.state.relativeTime !== null && "Days") || "Date",
          nameLocation: "center",
          nameGap: 30,
          axisPointer: {
            snap: true
          },
          type: (this.state.relativeTime !== null && "value") || "time",
          axisLine: { onZero: false },
          offset: 0
        }
      ],
      // Set the y-axis type and data
      yAxis: [
        {
          axisPointer: {
            snap: true
          },
          type: "category",
          data: [],
          min: 0
        }
      ],
      // Set the toolbox features
      toolbox: {
        feature: {
          dataZoom: {},
          restore: {},
          saveAsImage: {}
        }
      },
      // Set the data zoom options
      dataZoom: [
        {
          type: "slider",
          show: true,
          xAxisIndex: [0],
          start: "0%",
          end: "100%"
        },
        {
          type: "slider",
          show: true,
          yAxisIndex: [0],
          start: "0%",
          end: "100%"
        },
        {
          type: "inside",
          xAxisIndex: [0],
          start: "0%",
          end: "100%"
        },
        {
          type: "inside",
          yAxisIndex: [0],
          start: "0%",
          end: "100%"
        }
      ],

      // Set the brush options
      brush: {
        toolbox: ["lineX", "clear"],
        seriesIndex: "all",
        xAxisIndex: "all",
        yAxisIndex: "all",
        inBrush: {
          opacity: 1
        },
        throttleType: "debounce",
        throttleDelay: 300
      },
      // Set the series data
      series: [],
      // Set the legend options
      legend: {
        // Legend shows each patient
        title: {
          text: "<b>Patients</b>"
        },
        type: "scroll",
        orient: "vertical",
        right: 30,
        top: 50,
        bottom: "10%",
        padding: [150, 20],
        data: []
      }
    }

    // Create sets to store patient names, inner y classes, and new classes
    let patientNames = new Set()
    let innerYClasses = new Set()
    let newClasses = new Set()
    let newTimePointsClusters = []
    let numberOfPatients = this.state.jsonData?.list_MEDprofile?.length
    let profilesToHide = []

    // Loop through each MEDprofile in the jsonData
    this.state.jsonData?.list_MEDprofile?.forEach((profile, index) => {
      // Generate a color for the patient
      const color = d3.interpolateTurbo(this.state.jsonData.list_MEDprofile.indexOf(profile) / this.state.jsonData.list_MEDprofile.length)
      // Create a new series for the patient
      let profileSerie = {
        type: "scatter",
        data: [],
        name: profile.PatientID,
        itemStyle: { color: color },
        symbolSize: 5,
        emphasis: { focus: "series" },
        selectMode: "multiple"
      }
      let profileRandomTime = index
      let profilAttributeTimeZero = this.getTimeZeroForClass(this.state.relativeTime, index)
      if (profilAttributeTimeZero === null && this.state.relativeTime !== null) {
        // If the time zero attribute is null and the relative time is not null, add the patient ID to the profiles to hide array
        if (!((profilAttributeTimeZero !== null && this.state.relativeTime !== null) || this.state.relativeTime === null)) {
          profilesToHide.push(profile.PatientID)
        }
      }

      if ((profilAttributeTimeZero !== null && this.state.relativeTime !== null) || this.state.relativeTime === null) {
        // Add the patient name to the set
        patientNames.add(profile.PatientID)
        // Loop through each MEDtab in the profile
        profile?.list_MEDtab?.forEach((tab) => {
          let attributes = Object.keys(tab)
          // Loop through each attribute in the MEDtab
          if (tab.Date !== null) {
            attributes.forEach((attribute) => {
              // Add the attribute to the new classes set
              newClasses.add(attribute)
              if (attribute !== "Date") {
                let newDate = new Date(tab.Date)
                // Set the new date based on the relative time and time zero attribute
                if (profilAttributeTimeZero !== null) {
                  newDate = new Date(new Date(tab.Date) - new Date(profilAttributeTimeZero))
                }
                // Add the profile random time if separate horizontally is true
                if (this.state.separateHorizontally) {
                  newDate = Date.parse(newDate + profileRandomTime)
                }
                let x, y
                if (attribute !== "Time_point" && this.isNotNull(tab, attribute)) {
                  // Set the x and y values for the scatter plot
                  if (this.state.relativeTime !== null) {
                    x = newDate.valueOf() / (1000 * 60 * 60 * 24)
                    if (this.state.separateHorizontally) {
                      x = x + profileRandomTime / (numberOfPatients * 2)
                    }
                  } else {
                    x = newDate
                  }
                  if (this.state.separateVertically) {
                    y = attribute + profileRandomTime
                    innerYClasses.add(attribute + profileRandomTime)
                  } else {
                    y = attribute
                    innerYClasses.add(attribute)
                  }
                  profileSerie.data.push([x, y])
                } else if (attribute === "Time_point") {
                  let timePoints = tab[attribute]
                  if (timePoints === null) return
                  // Loop through each time point and add it to the new time points clusters array
                  timePoints.forEach((timePoint) => {
                    if (newTimePointsClusters[timePoint] === undefined || newTimePointsClusters[timePoint] === null) {
                      newTimePointsClusters[timePoint] = {
                        x: [],
                        y: [],
                        mode: "lines",
                        type: "scatter",
                        marker: { color: color },
                        text: [],
                        name: timePoint,
                        customdata: [],
                        fill: "toself"
                      }
                    }
                    newTimePointsClusters[timePoint].x.push(newDate)
                    if (this.state.separateVertically) {
                      newTimePointsClusters[timePoint].y.push(attribute + profileRandomTime)
                    } else {
                      newTimePointsClusters[timePoint].y.push(attribute)
                    }
                  })
                }
              }
            })
          }
        })
        newEchartsOption.series.push(profileSerie)
      }
      // }
    })
    // Set the y-axis data to the inner y classes set
    newEchartsOption.yAxis[0].data = [...innerYClasses]
    // Set the legend data to the patient names set
    newEchartsOption.legend.data = [...patientNames]
    let correctedTimePointClusters = []
    // Loop through each key in the new time points clusters object and add it to the corrected time points clusters array
    Object.keys(newTimePointsClusters).forEach((key) => {
      correctedTimePointClusters.push(newTimePointsClusters[key])
    })

    // Call the handleTimePointClustersChange function
    this.handleTimePointClustersChange(correctedTimePointClusters, newEchartsOption)
    if (this.state.echartsOptions !== null) {
      if (this.state.echartsOptions.series !== undefined) {
        if (this.state.echartsOptions.series.length !== newEchartsOption.series.length) {
          let error_message =
            "The number of patients has changed. The reloading time will be affected. Check your data for NaN values in the Date/Time values." +
            " If you are using the relative time, check if the selected class for relative time is not null for every patient." +
            " Problematic Patient IDs: " +
            profilesToHide.join(", ")
          toast.error(error_message)
          console.error(error_message)

          this.chartRef.current.getEchartsInstance().setOption(newEchartsOption, { notMerge: true })
        }
      }
    }

    this.setState({ echartsOptions: newEchartsOption })
    // Set the state with the new ECharts options, time point clusters, and classes
    this.setState({ timePointClusters: correctedTimePointClusters })
    this.setState({ classes: newClasses })
  }

  /**
   * Removes a time point from the jsonData and shapes state variables.
   * @param {number} timePoint - The time point to be removed.
   */
  removeTimePointFromJsonData = (timePoint) => {
    // Create a copy of the jsonData state variable
    let newJsonData = { ...this.state.jsonData }

    // Get time points to decrease
    let toDecrease = []
    if (timePoint < this.state.shapes.length) {
      for (let i = timePoint + 1; i < this.state.shapes.length + 1; i++) {
        toDecrease.push(i)
      }
    }

    // Loop through each profile and tab in the jsonData
    newJsonData.list_MEDprofile.forEach((profile) => {
      profile.list_MEDtab.forEach((tab) => {
        // If the tab does not have a time point, skip it
        if (tab.Time_point === null || tab.Time_point === undefined || tab.Time_point.length === 0) return

        // If the tab has the time point to be removed, remove it from the tab's time points
        if (tab.Time_point.includes(parseInt(timePoint))) {
          let timePointIndex = tab.Time_point.findIndex((timePointElement) => timePointElement === timePoint)
          tab.Time_point.splice(timePointIndex, 1)
        }

        // If there are time points to decrease, decrease them
        if (toDecrease.length > 0) {
          toDecrease.forEach((value) => {
            if (tab.Time_point.includes(parseInt(value))) {
              let timePointIndex = tab.Time_point.findIndex((timePointElement) => timePointElement === value)
              tab.Time_point[timePointIndex] = value - 1
            }
          })
        }
      })
    })

    // Create a copy of the shapes state variable
    let newShapes = [...this.state.shapes]

    // Loop through each shape in the shapes state variable
    this.state.shapes.forEach((shape) => {
      // If the shape is the time point to be removed, remove it from the shapes state variable
      if (shape.name === `T${timePoint}`) {
        let shapeIndex = newShapes.findIndex((shapeElement) => shapeElement.name === `T${timePoint}`)
        newShapes.splice(shapeIndex, 1)
      }
      // If there are time points to decrease, decrease them
      if (toDecrease.length > 0) {
        toDecrease.forEach((value) => {
          if (shape.name === `T${value}`) {
            let shapeIndex = newShapes.findIndex((shapeElement) => shapeElement.name === `T${value}`)
            newShapes[shapeIndex].name = `T${value - 1}`
          }
        })
      }
    })

    // Update the state variables with the new jsonData, shapes, and echartsOptions
    this.setState({ shapes: newShapes, jsonData: newJsonData }, () => {
      this.generateEchartsOptions()
      let newEchartsOptions = { ...this.state.echartsOptions }
      newEchartsOptions.series = [...this.state.echartsOptions.series, ...newShapes]

      this.chartRef.current.getEchartsInstance().setOption(newEchartsOptions, { notMerge: true })
    })
  }

  /**
   * Returns an array of objects with label and value properties, representing the available classes.
   * @returns {Array} An array of objects with label and value properties.
   */
  getClassesOptions = () => {
    // Get the classes from the component state
    let thisClasses = this.state.classes
    // If there are no classes, return an empty array
    if (thisClasses === null) return []
    // If there are no classes in the set, return an empty array
    if (thisClasses.size === 0) return []
    // Create an array to hold the class objects
    let classesArray = []
    // Iterate over the classes set
    thisClasses.forEach((className) => {
      // If the class name is not "Date" or "Time_point", add it to the array
      if (className !== "Date" && className !== "Time_point") {
        classesArray.push({ label: className, value: className })
      }
    })
    // Sort the array by label property
    classesArray.sort((a, b) => (a.label > b.label ? 1 : -1))
    // Return the array of class objects
    return classesArray
  }

  /**
   * Returns a function that can be used to find a patient by their ID.
   * @param {String} patientId - The ID of the patient to find.
   * @returns {Boolean} returns true if the patient's ID matches the given ID.
   */
  getFindPatientFunction = (patientId) => {
    return (patient) => {
      return patient.PatientID === patientId
    }
  }

  /**
   * Sets the time point for selected data points and updates the jsonData state accordingly.
   * @returns {void}
   */
  handleSetTimePoint = () => {
    // Creates a copy of the jsonData state
    let newJsonData = { ...this.state.jsonData }

    // Loops through each selected data point
    this.state.selectedData.forEach((data, seriesIndex) => {
      // Gets the series name and profile index for the current data point
      let seriesName = data.seriesName
      let profileIndex = newJsonData.list_MEDprofile.findIndex(this.getFindPatientFunction(seriesName))

      // Gets the profile and selected data points for the current data point
      let profile = newJsonData.list_MEDprofile[profileIndex]
      let selectedPoints = data.dataIndex

      // If the profile is undefined, returns early
      if (profile === undefined) return

      // Gets the corresponding data for the current data point
      let correspondingData = this.state.echartsOptions.series[seriesIndex].data

      // Filters the corresponding data to only include the selected data points
      let onlySelectedData = []
      correspondingData.forEach((dataPoint, index) => {
        if (selectedPoints.includes(index)) {
          onlySelectedData.push(dataPoint)
        }
      })

      // Initializes the patient global index
      let patientGlobalIndex = 0

      // Loops through each tab in the profile
      profile.list_MEDtab.forEach((tab) => {
        // Gets the attributes for the current tab
        let attributes = Object.keys(tab)
        if (tab.Date !== null) {
          // Loops through each attribute in the tab
          attributes.forEach((attribute) => {
            // If the attribute is not "Date", "Time_point", or null, and the data point is selected
            if (attribute !== "Date" && attribute !== "Time_point" && this.isNotNull(tab, attribute)) {
              if (selectedPoints.includes(patientGlobalIndex)) {
                // If the time point is null, sets it to the current time point
                if (tab.Time_point === null) {
                  tab.Time_point = [this.state.timePoint]
                } else {
                  // If the time point does not already include the current time point, adds it
                  if (!tab.Time_point.includes(this.state.timePoint)) {
                    tab.Time_point.push(this.state.timePoint)
                  }
                }
              }

              // Increments the patient global index
              patientGlobalIndex += 1
            }
          })
        }
      })
    })

    // Updates the jsonData state with the new data
    this.setState({ jsonData: newJsonData })
  }

  /**
   * Updates the selected data in the component's state.
   * @param {Object} data - The data to be selected.
   */
  handleSelectData = (data) => {
    this.setState({ selectedData: data.batch["0"].selected })
  }

  /**
   * This function exports the data for each time point to a separate CSV file.
   * @returns {void}
   */
  handleExportTimePoints = async () => {
    const { jsonData } = this.state
    let newJsonData = { ...jsonData }
    let timePointsData = {}
    // Loop through each profile and tab in the jsonData object
    newJsonData.list_MEDprofile.forEach((profile) => {
      profile.list_MEDtab.forEach((tab) => {
        if (tab.Time_point !== null) {
          if (tab.Time_point.length !== 0) {
            // Loop through each time point in the tab
            tab.Time_point.forEach((timePoint) => {
              if (timePointsData[timePoint] === undefined) {
                timePointsData[timePoint] = []
              }
              let attributes = Object.keys(tab)
              attributes.forEach((attribute) => {
                if (attribute !== "Date" && attribute !== "Time_point" && this.isNotNull(tab, attribute)) {
                  if (timePointsData[timePoint][attribute] === undefined) {
                    timePointsData[timePoint][attribute] = []
                  }
                  // Add the data for the attribute to the time point data object
                  timePointsData[timePoint][attribute].push({ Date: tab.Date, ID: profile.PatientID, Class: attribute, ...tab[attribute] })
                }
              })
            })
          }
        }
      })
    })

    // Export the time point data to CSV files
    for (const timePoint of Object.keys(timePointsData)) {
      await this.timePointToCsv(timePoint, timePointsData[timePoint])
    }
  }

  /**
   * This method returns the median of an array.
   * @param {Array} arr - The array to calculate the median from.
   * @returns {number} - The median of the array.
   */
  median(arr) {
    if (!Array.isArray(arr) || arr.length === 0) {
      return null
    }
    arr.sort((a, b) => a - b)
    const half = Math.floor(arr.length / 2)
    if (arr.length % 2) {
      return arr[half]
    }
    return (arr[half - 1] + arr[half]) / 2.0
  }

  /**
   * This method returns the sum of an array.
   * @param {Array} arr - The array to calculate the sum from.
   * @returns {number} - The sum of the array.
   */
  sum(arr) {
    if (!Array.isArray(arr) || arr.length === 0) {
      return null
    }
    return arr.reduce((a, b) => a + b, 0)
  }

  /**
   * This method returns the first element of an array. If the element is undefined, it returns the next element.
   * @param {Array} arr - The array to get the first element from.
   * @returns {number} - The first element of the array.
   * @description This method is recursive.
   */
  first(arr) {
    if (!Array.isArray(arr) || arr.length === 0) {
      return null
    }
    let first = arr.shift()
    if (first === undefined && arr.length !== 0) {
      return this.first(arr)
    }
    return first
  }

  /**
   * This method returns the last element of an array. If the element is undefined, it returns the previous element.
   * @param {Array} arr - The array to get the last element from.
   * @returns {number} - The last element of the array.
   * @description This method is recursive.
   */
  last(arr) {
    if (!Array.isArray(arr) || arr.length === 0) {
      return null
    }
    let last = arr.pop()
    if (last === undefined && arr.length !== 0) {
      return this.last(arr)
    }
    return last
  }

  /**
   * This method returns the mode of an array.
   * @param {Array} arr - The array to get the mode from.
   * @returns {number} - The mode of the array.
   */
  mode(arr) {
    if (!Array.isArray(arr) || arr.length === 0) {
      return null
    }
    let modeMap = {}
    let maxEl = arr[0],
      maxCount = 1
    for (let i = 0; i < arr.length; i++) {
      let el = arr[i]
      if (modeMap[el] === null) {
        modeMap[el] = 1
      } else {
        modeMap[el]++
      }
      if (modeMap[el] > maxCount) {
        maxEl = el
        maxCount = modeMap[el]
      }
    }
    return maxEl
  }

  /**
   * Merging the data by patient ID and time point into a single row with the selected method.
   * @param {Object} timePointData - The data for a given time point.
   * @returns {Object} - The merged data.
   */
  mergeTimePointData = (timePointData) => {
    // Apply the merging method to the time points data
    let dfTimePointsDataMerged = timePointData.groupby(["ID"])
    if (dfTimePointsDataMerged === undefined) return
    let patientIds = Object.keys(dfTimePointsDataMerged.keyToValue)
    let newData = {}
    patientIds.forEach((patientId) => {
      let patientData = dfTimePointsDataMerged.getGroup([patientId])
      let selectedMethod = this.state.selectedMergingMethod
      let droppedColumns = ["Class", "Date"]
      patientData = patientData.drop({ columns: droppedColumns })
      patientData = patientData.applyMap((value) => parseFloat(value))
      switch (selectedMethod) {
        case "mean": {
          patientData = patientData.mean({ axis: 0 })
          break
        }
        case "median":
          patientData = patientData.apply(this.median, { axis: 0 })
          break
        case "max":
          patientData = patientData.max({ axis: 0 })
          break
        case "min":
          patientData = patientData.min({ axis: 0 })
          break
        case "sum":
          patientData = patientData.drop({ columns: ["ID"] })
          patientData = patientData.sum({ axis: 0 })
          patientData = new dfd.Series([patientId], { index: ["ID"] }).append(patientData.values, patientData.index)
          break
        case "first":
          patientData = patientData.apply(this.first, { axis: 0 })
          break
        case "last":
          patientData = patientData.apply(this.last, { axis: 0 })

          break
        case "mode":
          patientData = patientData.apply(this.mode, { axis: 0 })
          break
        default:
          patientData = patientData.mean({ axis: 0 })
          break
      }
      let patientDf = new dfd.DataFrame([patientData.values], { columns: patientData.index })

      newData[patientId] = patientDf
    })
    return newData
  }

  exportTimePointToDatabase = async (fileName, jsonData, timePoint, folderPath) => {
    let timePointsFolderId = null

    // Connect to the database
    const db = await connectToMongoDB()
    let collection = db.collection("medDataObjects")

    // Find MEDprofiles folder
    const MEDProfilesFolder = await collection.findOne({ name: "MEDprofiles", type: "directory", parentID: "DATA" })

    // Find timePoints folder
    let timePointsFolder = await collection.findOne({ name: "timePoints", type: "directory", parentID: MEDProfilesFolder.id })

    if (timePointsFolder) {
      timePointsFolderId = timePointsFolder.id
    } else {
      // Create the time points folder locally
      folderPath = folderPath + getPathSeparator() + "timePoints" + getPathSeparator()
      createFolderFromPath(folderPath)

      // Create timePoints folder MEDDataObject
      const timePointsFolderObject = new MEDDataObject({
        id: randomUUID(),
        name: "timePoints",
        type: "directory",
        parentID: MEDProfilesFolder.id,
        childrenIDs: [],
        inWorkspace: true
      })
      await insertMEDDataObjectIfNotExists(timePointsFolderObject)
      MEDDataObject.updateWorkspaceDataObject()
      timePointsFolderId = timePointsFolderObject.id
    }

    // Create a new MEDDataObject for the file
    const id = randomUUID()
    const object = new MEDDataObject({
      id: id,
      name: fileName,
      type: "csv",
      parentID: timePointsFolderId,
      childrenIDs: [],
      inWorkspace: false
    })

    // Check if the file already exists
    const existingObjectByAttributes = await collection.findOne({ name: object.name, type: object.type, parentID: object.parentID })

    if (existingObjectByAttributes) {
      // If object already in the DB, show a confirmation dialog to overwrite it
      const overwriteConfirmation = await new Promise((resolve) => {
        confirmDialog({
          closable: false,
          message: `The file ${fileName} already exists in the ROOT folder. Do you want to overwrite it?`,
          header: "Confirmation",
          icon: "pi pi-exclamation-triangle",
          accept: () => resolve(true),
          reject: () => {
            resolve(false)
            this.setState({ isWorking: false })
          }
        })
      })

      if (overwriteConfirmation) {
        // If the user accepts, remove the existing file
        collection = db.collection(existingObjectByAttributes.id)
        await collection.deleteMany({})

        // Save the new data to the CSV file inside the MongoDB database
        await collection.insertMany(jsonData)
        MEDDataObject.updateWorkspaceDataObject()
        toast.success(`Time point ${timePoint} exported to the database`)
      }
    } else {
      // Create a new collection and insert data
      await db.createCollection(object.id)
      collection = db.collection(object.id)
      await collection.insertMany(jsonData)

      // Insert the object into the database and update workspace
      await insertMEDDataObjectIfNotExists(object)
      MEDDataObject.updateWorkspaceDataObject()

      // Show a success message
      toast.success(`Time point ${timePoint} exported to the database`)
    }
  }

  /**
   * This function exports the data for a given time point to a CSV file.
   * @param {number} timePoint - The time point to export.
   * @param {Object} timePointData - The data for the time point.
   * @returns {void}
   */
  timePointToCsv = async (timePoint, timePointData) => {
    // eslint-disable-next-line no-undef
    if (timePointData === undefined) return
    if (Object.keys(timePointData).length >= 1) {
      // If there is at least one attribute
      let dfList = [] // Create a list to store the dataframes
      Object.keys(timePointData).forEach((attribute) => {
        // Loop through each attribute
        let localDf = new dfd.DataFrame(timePointData[attribute])
        let renamingDict = {} // Create a dictionary to store the renaming information
        let columns = localDf.columns
        columns.forEach((column) => {
          if (column !== "Date" && column !== "ID" && column !== "Class") {
            renamingDict[column] = attribute + "_|_" + column
          }
        })
        localDf = localDf.rename(renamingDict)
        dfList.push(localDf)
      })

      let dfData = dfd.concat({ dfList: dfList, axis: 0 }) // Concatenate the dataframes
      if (this.state.mergeTimePoints !== false) {
        // If the merge time points option is selected
        let mergedDfData = this.mergeTimePointData(dfData)
        dfData = new dfd.concat({ dfList: Object.values(mergedDfData), axis: 0 })
      }
      let fileName = "T" + timePoint + ".csv" // Create the file path
      let jsonData = dfd.toJSON(dfData) // Convert the dataframe to JSON
      try {
        // Export the data to the database
        await this.exportTimePointToDatabase(fileName, jsonData, timePoint, this.state.folderPath)
      } catch (error) {
        console.error("error", error)
        toast.error("Error exporting time point to the database")
      } finally {
        // Do nothing
        this.setState({ isWorking: false })
      }
      return
    }
  }

  /**
   * Renders the MEDcohortFigure component.
   * @returns {JSX.Element} The rendered component.
   */
  render() {
    // Destructure state and props for easier access
    const { selectedClass, relativeTime, separateVertically, separateHorizontally, selectedClassesToSetTimePoint, shapes, timePoints, timePoint, echartsOptions } = this.state
    let newEchartsOption = { ...echartsOptions }
    if (echartsOptions !== null) {
      newEchartsOption.series = [...echartsOptions.series, ...shapes]
    }
    let themeName = "light"
    if (this.state.darkMode === undefined || this.state.darkMode === false) {
      themeName = "light"
    }
    if (this.state.darkMode === true) {
      themeName = "dark"
    }

    return (
      <>
        <Row style={{ display: "flex", flexDirection: "row", width: "100%", height: "100%", justifyContent: "space-evenly", margin: "0rem" }}>
          <Col lg={8} className="MEDcohort-figure center" style={{ display: "flex", flexDirection: "column", boxShadow: "2px 2px 4px rgba(0, 0, 0, 0.25)", borderRadius: " 1rem", padding: "0" }}>
            {echartsOptions && (
              <ReactECharts
                className="echarts-custom"
                ref={this.chartRef}
                option={newEchartsOption}
                theme={themeName}
                onEvents={{ brushselected: this.handleSelectData }}
                style={{ width: "100%", height: "100%" }}
                lazyUpdate={true}
                class={"echarts-scatter"}
              />
            )}
          </Col>

          <Col lg={4} style={{ display: "flex", flexDirection: "column", justifyContent: "space-evenly" }}>
            <Row
              className="justify-content-md-center medprofile-buttons"
              style={{
                display: "flex",
                flexDirection: "row",
                alignContent: "center",
                alignItems: "center",
                width: "100%",
                justifyContent: "center",
                boxShadow: "2px 2px 4px rgba(0, 0, 0, 0.25)",
                padding: "1rem",
                borderRadius: "1rem",
                margin: "0.5rem"
              }}
            >
              <Col xxl="6" style={{ display: "flex", flexDirection: "row", justifyContent: "center", marginBottom: "1rem" }}>
                <ToggleButton
                  className="separate-toggle-button"
                  checked={separateHorizontally}
                  onChange={(e) => this.setState({ separateHorizontally: e.value })}
                  onLabel="Overlap horizontally"
                  offLabel="Separate horizontally"
                  onIcon="pi pi-check"
                  offIcon="pi pi-times"
                />
              </Col>
              <Col xxl="6" style={{ display: "flex", flexDirection: "row", justifyContent: "center", marginBottom: "1rem" }}>
                <ToggleButton
                  className="separate-toggle-button"
                  checked={separateVertically}
                  onChange={(e) => this.setState({ separateVertically: e.value })}
                  onLabel="Overlap vertically"
                  offLabel="Separate vertically"
                  onIcon="pi pi-check"
                  offIcon="pi pi-times"
                />
              </Col>
              <Col style={{ display: "flex", flexDirection: "column", justifyContent: "center", marginBottom: "1rem" }}>
                <label htmlFor="dd-city">Select the class for relative time</label>
                <Col style={{ display: "flex", flexDirection: "row", justifyContent: "center", marginTop: "0rem" }}>
                  <div style={{ width: "100%" }} className="p-inputgroup ">
                    <Dropdown className="medcohort-drop" style={{}} value={selectedClass} options={this.getClassesOptions()} onChange={(e) => this.setState({ selectedClass: e.value })} />
                    <ToggleButton // Sets and unsets the relative time
                      className={`separate-toggle-button relative-time-toggle-button ${relativeTime !== null ? "p-button-success" : "p-button-info"}`}
                      checked={relativeTime === null}
                      onLabel="Set"
                      offLabel="Unset"
                      onChange={() => {
                        if (relativeTime === null) {
                          this.setState({ relativeTime: selectedClass })
                        } else {
                          this.setState({ relativeTime: null })
                        }
                      }}
                      disabled={!selectedClass}
                      style={{ borderRadius: "0 4px 4px 0", padding: "0rem", minWidth: "3rem" }}
                    />
                  </div>
                </Col>
              </Col>
              <Col style={{ display: "flex", flexDirection: "column", justifyContent: "center", marginBottom: "1rem" }}>
                <label htmlFor="dd-city">Set time points to selected data points</label>
                <Col style={{ display: "flex", flexDirection: "row", justifyContent: "center", marginTop: "0rem" }}>
                  <div style={{ width: "100%" }} className="p-inputgroup ">
                    <Dropdown className="medcohort-drop" value={timePoint} options={timePoints} onChange={(e) => this.setState({ timePoint: e.value })} />
                    <Button
                      className="separate-toggle-button"
                      style={{ borderRadius: "0 4px 4px 0", padding: "0rem", minWidth: "3rem" }}
                      onClick={this.handleSetTimePoint}
                      label={`Set T${timePoint}`}
                    />
                  </div>
                </Col>
              </Col>
              <Col style={{ display: "flex", flexDirection: "column", justifyContent: "center", marginBottom: "1rem" }}>
                <label htmlFor="dd-city">Set time points by classes</label>
                <Col style={{ display: "flex", flexDirection: "row", justifyContent: "center", marginTop: "0rem" }}>
                  <div style={{ width: "100%" }} className="p-inputgroup ">
                    <MultiSelect
                      className="medcohort-drop"
                      filter
                      value={selectedClassesToSetTimePoint}
                      options={this.getClassesOptions()}
                      onChange={(e) => this.setState({ selectedClassesToSetTimePoint: e.value })}
                    />
                    <Button
                      className="separate-toggle-button"
                      style={{ borderRadius: "0 4px 4px 0", padding: "0rem", minWidth: "3rem" }}
                      onClick={this.handleSetTimePointByClass}
                      disabled={!selectedClassesToSetTimePoint || selectedClassesToSetTimePoint.length < 1}
                      label={`Set T${timePoint}`}
                    />
                  </div>
                </Col>
              </Col>
              <Col style={{ display: "flex", flexDirection: "column", justifyContent: "center", marginTop: "1rem", alignItems: "flex-start", flex: "unset" }}>
                {this.state.timePointClusters.length !== 0 && (
                  <>
                    <label htmlFor="">
                      <b>
                        <u>Time Points associated data</u>
                      </b>
                    </label>
                    {this.state.timePointClusters.map((cluster, clusterIndex) => {
                      return (
                        <>
                          <div key={"div" + clusterIndex} style={{ display: "flex", flexDirection: "row", alignContent: "center", alignItems: "flex-start", justifyContent: "center" }}>
                            <h6 key={"h6" + clusterIndex} style={{ margin: "0" }}>{`T${cluster.name}`}</h6>

                            <p key={"p" + clusterIndex} style={{ margin: "0", marginLeft: "0.5rem" }}>
                              {" "}
                              {`Number of data points: `}
                              <b key={"b" + clusterIndex}> {`${cluster.x.length}`}</b>
                            </p>
                            <a
                              key={"a" + clusterIndex}
                              value={cluster.name}
                              style={{ margin: "0", marginLeft: "0.5rem", cursor: "pointer" }}
                              onClick={() => {
                                let newTimePoints = deepCopy(timePoints)
                                let indexOfTimePoint = newTimePoints.findIndex((timePoint) => timePoint.value === cluster.name)
                                if (indexOfTimePoint !== -1 && cluster.name !== 1) {
                                  newTimePoints.splice(indexOfTimePoint, 1)
                                }
                                this.setState({ timePoints: newTimePoints })
                                this.removeTimePointFromJsonData(cluster.name)
                              }}
                            >
                              <XSquare key={"xsquare" + clusterIndex} size={20} />
                            </a>
                          </div>
                        </>
                      )
                    })}
                  </>
                )}
              </Col>{" "}
              &nbsp;
              <Col style={{ display: "flex", flexDirection: "row", justifyContent: "center", marginTop: "1rem", alignItems: "center", flex: "unset", marginBottom: "1rem" }}>
                <Checkbox
                  label="Merge time points by patient"
                  inputId="merge-time-points"
                  checked={this.state.mergeTimePoints?.checked || false}
                  disabled={timePoints.length <= 1 || this.state.isWorking}
                  onChange={(e) => {
                    console.log("e", e.checked)
                    this.setState({ mergeTimePoints: { checked: e.checked } })
                  }}
                />
                <label htmlFor="merge-time-points" style={{ marginLeft: "1rem" }} disabled={timePoints.length <= 1 || this.state.isWorking}>
                  <strong>Merge time points by patient</strong>
                </label>
              </Col>
              <Col style={{ display: "flex", flexDirection: "column", justifyContent: "center", marginBottom: "1rem" }}>
                <label htmlFor="dd-city">Set merging method for timepoints</label>
                <Col style={{ display: "flex", flexDirection: "row", justifyContent: "center", marginTop: "0rem" }}>
                  <div style={{ width: "100%" }} className="p-inputgroup ">
                    <Dropdown
                      className="medcohort-drop"
                      disabled={timePoints.length <= 1 || this.state.isWorking}
                      value={this.state.selectedMergingMethod}
                      options={this.mergingMethodsOptions}
                      onChange={(e) => this.setState({ selectedMergingMethod: e.value })}
                    />
                  </div>
                </Col>
              </Col>
              <Col style={{ display: "flex", flexDirection: "column", justifyContent: "center", marginTop: "1rem", alignItems: "flex-start", flex: "unset" }}>
                <Button
                  label={
                    <div>
                      {this.state.isWorking && (
                        <>
                          <Spinner />
                        </>
                      )}
                      <p style={{ margin: "0rem" }}> &nbsp;Export timepoints to CSVs</p>{" "}
                    </div>
                  }
                  disabled={timePoints.length <= 1 || this.state.isWorking}
                  onClick={() => {
                    this.setState({ isWorking: true })
                    this.handleExportTimePoints()
                  }}
                />
              </Col>
            </Row>
          </Col>
        </Row>
      </>
    )
  }
}

export default MEDcohortFigureClass
