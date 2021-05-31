<template>
  <div class="page page--index">
    <h3>Edit page/snippet</h3>
    Page url: <input type="text" v-model="url" placeholder="Page url">
    <button v-bind:disabled="requestInProgress" v-on:click="getPage()">Get page</button>

    <div class="container">
      <div class="field-row" v-for="field in fields">
        <div class="title">{{field.title}}</div>
        <div class="text-container" v-if="field.type === 'text'" v-bind:class="field.title">
          <div class="form-group" v-bind:class="{'selected': field.needUpdate}">
            <input type="checkbox" v-bind:id="field.key" v-model="field.needUpdate">
            <label v-bind:for="field.key">Update field</label>
          </div>
          <textarea v-bind:rows="field.title === 'content' ? 15 : 2" v-model="field.value"></textarea>
        </div>
        <div class="checkboxes-container" v-if="field.type === 'checkboxes'">
          <div class="checkbox" v-for="checkbox in field.values">
            <div class="title-checkbox-group">
              {{checkbox.title}}
              <div class="form-group" v-bind:class="{'selected': checkbox.needUpdate}">
                <input type="checkbox" v-bind:id="checkbox.key" v-model="checkbox.needUpdate">
                <label v-bind:for="checkbox.key">Update field</label>
              </div>
            </div>
            <input type="checkbox" v-model="checkbox.value">
          </div>
        </div>
      </div>
      <div class="field-row checkboxes-container" v-if="locales && locales.length">
        <div class="title">Update page on locales <button v-on:click="selectAllLocales()">Select all</button></div>
        <div class="checkbox" v-for="locale in locales">
          {{locale.title}}
          <input type="checkbox" v-model="locale.checked">
        </div>
      </div>
      <button v-bind:disabled="requestInProgress" v-if="fields && fields.length" v-on:click="generateResult">Generate result</button>
      <div class="result">
        {{updateResult}}
      </div>
      <button v-bind:disabled="requestInProgress" v-if="updateResult" v-on:click="updatePage">Update pages</button>
      <div class="log-container">
        <div class="log" v-bind:class="log.type" v-for="log in logs">
          {{log.message}}
        </div>
      </div>
    </div>

  </div>
</template>

<style type="text/css">
  .container {
    display: flex;
    flex-direction: column;
  }
  .field-row {
    border-top: 2px solid black;
  }
  .title {
    padding: 10px 0;
    text-transform: capitalize;
    font-weight: bold;
  }
  .form-group {
    border: 2px solid #a7305a;
    display: inline-block;
    padding: 5px;
    border-radius: 10px;
  }
  .form-group.selected {
    border-color: #30a734;
  }
  .text-container {
    display: flex;
    flex-direction: column;
    align-items: start;
  }
  textarea {
    margin: 10px 0;
    width: 100%;
  }
  .checkbox {
    border: 2px solid;
    border-radius: 10px;
    display: inline-flex;
    padding: 5px;
    align-items: center;
    margin: 5px;
  }
  button {
    margin: 10px;
  }
  .result, .log-container {
    font-weight: bold;
    font-size: 12px;
  }
  .log {
    display: block;
    color: #30a734;
  }
  .log.error {
    color: #a7305a;
  }
  .log.end {
    color: #5030a7;
  }
</style>

<script>

import axios from 'axios';
import CookiesService from '../services/cookies.service';

export default {
  components: {
  },
  data: function() {
    return {
      url: '',
      requestInProgress: false,
      locales: [],
      fields: [],
      updateResult: null,
      logs: []
    }
  },
  methods: {
    getPage() {
      this.requestInProgress = true;
      this.updateResult = null;
      this.logs = [];
      const params = CookiesService.setAuthParams({page: this.url});
      axios.get('/page-info', {params}).then(({data} = {}) => {
        this.locales = data.locales.map((title) => {
          return {
            title,
            checked: false,
          }
        });
        this.fields = Object.keys(data.preparedFields).reduce((result, key) => {
          if (key === 'categories' || key === 'published') {
            const checkboxesObj = {
              title: key,
              type: 'checkboxes',
              values: key === 'categories' ? Object.values(data.preparedFields[key]) : [data.preparedFields[key]]
            };
            result.push(checkboxesObj);
          } else {
            data.preparedFields[key].type = 'text';
            result.push(data.preparedFields[key]);
          }
          return result;
        }, []);
      }).finally(() => {
        this.requestInProgress = false;
      });
    },
    generateResult() {
      this.updateResult = this.fields.reduce((result, field) => {
        if (field.type === 'checkboxes') {
          field.values.forEach((checkbox) => {
            if (checkbox.needUpdate) {
              result[checkbox.key] = +checkbox.value;
            }
          })
        } else if (field.type === 'text') {
          if (field.needUpdate) {
            result[field.key] = field.value;
          }
        }
        return result;
      }, {});
    },
    updatePage() {
      const locales = this.locales.filter((item) => item.checked).map(item => item.title);
      if (this.updateResult && Object.keys(this.updateResult).length && locales.length) {
        this.requestInProgress = true;
        const params = CookiesService.setAuthParams({page: this.url});
        const body = {
          locales,
          newValues: this.updateResult
        };
        axios.post('/update-page', body, {params}).then(({data} = {}) => {
          this.logs = [];
          return this.setPageListener(data);
        }).finally(() => {
          this.requestInProgress = false;
        });
      }
    },
    selectAllLocales() {
      this.locales.forEach((locale) => {
        locale.checked = true;
      });
    },
    setPageListener(params) {
      const paramsQuery = '?' + Object.keys(params).map((key) => {
        return `${key}=${params[key]}`;
      }).join('&')
      const eventSource = new EventSource('apply-request' + paramsQuery);
      return new Promise((resolve, reject) => {
        eventSource.onerror = (e) => {
          console.log("Event: error", e);
          eventSource.close();
          reject(e);
        };
        eventSource.addEventListener('message', (message) => {
          try {
            const logMessage = JSON.parse(message.data);
            this.logs.push(logMessage);
          } catch (e) {

          }
          if (message.data === 'close') {
            eventSource.close();
            this.logs.push({message: 'End', type: 'end'});
            resolve()
          }
        });
      });
    }
  },
  mounted: () => {
  }
}
</script>