;(function (window, document, d3, newssimData) {
  'use strict';

  // Monkey patching for ES7 array includes
  Array.prototype.includes = function (element) {
    return (this.indexOf(element) !== -1)
  }

  /**
   * Get the frequencies of a keyword in a data on daily basis
   * Days with no mentions are not included at all
   * @param {string}    word: keyword to search
   * @param {object}  data: database of content, arary of objects with content field
   * @return {object}   in form of {20130202: 3,
   *                                20130804: 2,
   *                                ...}
   */
  function countWordByDay (word, data) {

    let result = {}

    for (let entry of data) {
      if (entry.content.includes(word)) {
        if (result[entry.publish_date]) {
          result[entry.publish_date] += 1
        } else {
          result[entry.publish_date] = 1
        }
      }
    }

    return result
  }

  /**
   * Extract parts (year, month, or day) from a date string in the form of 20120823
   * @param {string} dateString
   * @returns {string[]}
   */
  function separateDateComponents(dateString) {
    return [dateString.slice(0, 4),
            dateString.slice(4, 6),
            dateString.slice(6, 8)]
  }

  /**
   * Aggregate word frequencies by day, month, or year
   * @param {object} wordCounts
   * @param {string} period
   */
  function aggregatePeriod (wordCounts, period = 'month') {

    let result = {}

    let key, getKey
    if (period === 'year') {
      getKey = (date) => date.slice(0, 4)
    } else if (period === 'month') {
      getKey = (date) => date.slice(0, 6)
    } else if (period === 'day') {
      getKey = (date) => date.slice(0, 8)
    } else {
      throw new Error('un-implemented period: ', period)
    }

    for (let date in wordCounts) if (wordCounts.hasOwnProperty(date)) {
      key = getKey(date)

      if (result[key]) {
        result[key] += wordCounts[date]
      } else {
        result[key] = wordCounts[date]
      }
    }

    return result
  }

  /**
   * Input n and return '0n' if n < 0
   * @param n
   */
  function padDatePart(n) {
    if (n < 10) {
      return '0' + n
    } else {
      return '' + n
    }
  }

  function getDaysInMonth(month) {
    let thirtyDaysMonth = [4, 6, 9, 11]
    let thirtyoneDaysMonth = [1, 3, 5, 7, 8, 10, 12]

    if (thirtyDaysMonth.includes(month)) {
      return 30
    } else if (thirtyoneDaysMonth.includes(month)) {
      return 31
    } else {
      return 28
    }

    //FIXME: Wrong results on leap years

  }

  /**
   * Return the intervals of two dates, for example, input '201408' and '201502',
   * you get ['201408', '201409', '201410', '201411', '201412', '201501', '201502']
   * @param {string} startDate
   * @param {string} endDate
   */
  function getDateIntervals (startDate, endDate) {
    if (startDate.length !== endDate.length) {
      throw new Error('startDate and endDate have different length; aborting...')
    }

    let result = [];
    let startYear, startMonth, startDay, endYear, endMonth, endDay
    switch (startDate.length) {

      // Years, like '2011' to '2015
      case 4:
        for (let i = +startDate; i <= +endDate; i += 1) {
          result.push(i.toString())
        }
        break;

      // Months, like '201104' to '201501'
      case 6:

        startYear = +startDate.slice(0, 4)
        startMonth = +startDate.slice(4, 6)
        endYear = +endDate.slice(0, 4)
        endMonth = +endDate.slice(4, 6)

        for (let year = startYear; year <= endYear; year += 1) {
          for (let month = 1; month <= 12; month += 1) {

            // First year: skip months before startMonth
            if ((year === startYear) && (month < startMonth)) {
              continue
            }

            // Last year: skip months after endMonth
            if ((year === endYear) && (month > endMonth)) {
              continue
            }

            result.push(year.toString() + padDatePart(month.toString()))
          }
        }

        break;

      // Days, like '20120401' to '20130801'
      case 8:
        startYear = +startDate.slice(0, 4)
        startMonth = +startDate.slice(4, 6)
        startDay = +startDate.slice(6, 8)
        endYear = +endDate.slice(0, 4)
        endMonth = +endDate.slice(4, 6)
        endDay = +endDate.slice(6, 8)

        for (let year = startYear; year <= endYear; year += 1) {
          for (let month = 1; month <= 12; month += 1) {
            for (let day = 1; day <= getDaysInMonth(month); day += 1) {

              // First year: skip months before startMonth
              if ((year === startYear) && (month < startMonth)) {
                continue
              }

              // Last year: skip months after endMonth
              if ((year === endYear) && (month > endMonth)) {
                continue
              }

              // First year and first month: skip days before startDay
              if ((year === startYear) && (month === startMonth) && (day < startDay)) {
                continue
              }

              // last year and last month: skip days after startDay
              if ((year === endYear) && (month === endMonth) && (day > endDay)) {
                continue
              }

              result.push('' + year + padDatePart(month) + padDatePart(day))
            }
          }
        }

        break;

      default:
        throw new Error(`Unrecognized date format: ${startDate}`)
    }

    return result
  }

  /**
   * Transform data in form of {'201404': 32, '201408': 6} into an array like
   * [{period: '201404', value: 32},
   *  {period: '201406', value:  0},
   *  {period: '201407', value:  0},
   *  {period: '201408', value:  6}]
   * @param {object} data
   */
  function transformToArray (data) {

    let result = []

    // Get the range of dates from data
    let minDate = 'Z'
    let maxDate = ''

    for (let key in data) if (data.hasOwnProperty(key)) {
      if (key < minDate) {
        minDate = key
      }

      if (key > maxDate) {
        maxDate = key
      }
    }

    // Generate the array by pushing period-value pairs one by one
    for (let period of getDateIntervals(minDate, maxDate)) {
      if (data[period]) {
        result.push({
          period,
          value: data[period]
        })
      } else {
        result.push({
          period,
          value: 0
        })
      }
    }

    return result
  }

  /*================================================

   END of data-processing helper functions;
   START of DOM manipulation

  =================================================*/

  /**
   * Get the period (e.g. 'year' or 'month'),
   * chosen through radio option in the HTML form
   * @returns {string}
   */
  function getChosenPeriod () {

    const options = document.getElementsByName('period')
    for (let i = 0; i < options.length; i += 1) {
      if (options[i].checked) {
        return options[i].value
      }
    }
  }

  const getMaxValue = (data) =>
    data.reduce((max, entry) => entry.value > max ? entry.value : max , 0)

  const padValue = (value, maxValue) => {
    let result = value.toString()
    while (result.length < maxValue.toString().length) {
      result = '<span class="zeroPad">0</span>' + result
    }
    return result
  }

  // Hide loading notice as the script has been fully loaded by now
  const loadingNotice = document.getElementsByClassName('loading-notice')[0]
  loadingNotice.parentNode.removeChild(loadingNotice)

  // Get UI elements
  const btnConfirm = document.getElementsByClassName('btnConfirm')[0]
  const keywordInput = document.getElementsByClassName('keywordInput')[0]
  const dataDisplay = document.getElementById('display')

  btnConfirm.addEventListener('click', (event) => {

    /**
     *  Display the bars
     */

    let searchResults = transformToArray(aggregatePeriod(countWordByDay(keywordInput.value, newssimData), getChosenPeriod()))

    let maxValue = getMaxValue(searchResults)

    let barScale = d3.scale.linear()
      .domain([0, maxValue])
      .range([0, window.innerWidth / 2])

    let selections = d3.select('#display').selectAll('p').data(searchResults,
      d => d.period)

    let newLines = selections.enter().append('p')
    newLines.append('span')
      .classed({
        'description': true
      })

    newLines.append('div')
      .classed({
        "barBody": true
      })

    selections.selectAll('span.description')
      .html(d => `[${d.period}: ${padValue(d.value, maxValue)}]`)

    selections.selectAll('div.barBody')
      .attr('data-keyword', keywordInput.value)
      .attr('data-period', d => d.period)
      .style('width', '0')
      .transition()
      .style('width', d => (barScale(d.value) + 'px'))

    selections.exit().remove()

  })

  function prettifyLightboxContent (content, keyword, highlightClass) {
    let result = content
    let re

    re = new RegExp('\\n', 'g')
    result = result.replace(re, '<br>')

    re = new RegExp('\n', 'g')
    result = result.replace(re, '<br>')

    re = new RegExp('\s', 'g')
    result = result.replace(re, '<br>')

    re = new RegExp(keyword, 'g')
    result = result.replace(re, `<span class=${highlightClass}>${keyword}</span>`)

    return result
  }

  function prettifyDate(s) {
    return [s.slice(0, 4), s.slice(4, 6), s.slice(6, 8)].join('-')
  }

  function createRecordLightbox (data, keyword) {

    let div = document.createElement('div')
    div.className = 'lightbox'

    let html = ''

    for (let i = 0; i < data.length; i += 1) {
      html += `
        <div class="lightbox-content">
          <div>
            <span>
              [${i + 1}]
            </span>
            <time>
              ${prettifyDate(data[i].publish_date)}
            </time>
            <a href=${data[i].url} target="_blank">${data[i].url}</a>
          </div>
          <div class="lightbox-text">
            ${prettifyLightboxContent(data[i].content, keyword, 'lightbox-highlight')}
          </div>
        </div>
      `
    }

    div.innerHTML = html
    document.body.style.overflow = 'hidden'

    document.addEventListener('keydown', event => {
      if (event.keyCode === 27) {
        div.style.display = 'none'
        document.body.style.overflow = 'scroll'
      }
    })

    return div
  }

  dataDisplay.addEventListener('click', event => {

    /**
     *   A bar in the bar-chart is clicked:
     *   Display detailed information about that day
     */

    if (event.target.className === 'barBody') {

      let keyword = event.target.dataset.keyword
      let period = event.target.dataset.period

      let relevantData = newssimData
        .filter(record => record.content.includes(keyword))
        .filter(record =>
          record.publish_date.startsWith(period))

      let lightbox = createRecordLightbox(relevantData, keyword)
      document.body.appendChild(lightbox)
    }


  })

})(window, window.document, window.d3, window.newssim_db)