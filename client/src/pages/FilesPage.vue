<template>
  <div class="page page--index">
    <h3>Edit files</h3>
    File name/url: <input type="text" v-model="fileName" placeholder="File name/url">
    <button v-bind:disabled="requestInProgress" v-on:click="searchFiles()">Search files</button>

    <div class="container">
      <div class="files-table">
        <tbody>
          <template v-for="(file, index) in files">
            <tr class="file">
              <td class="icon" v-bind:style="file.icon"></td>
              <td class="id">{{file.fileId}}</td>
              <td class="name">{{file.title}}</td>
              <td class="edit_url">{{file.editUrl}}</td>
            </tr>
            <tr class="file-info">
              <td colspan="4">
                <div class="field-row" v-for="field in (file.fields || [])">
                  <div class="title">{{field.title}}</div>
                  <div class="text-container" v-if="field.type === 'text'" v-bind:class="field.title">
                    <div class="form-group" v-bind:class="{'selected': field.needUpdate}">
                      <input type="checkbox" v-bind:id="field.key + '-' + index" v-model="field.needUpdate">
                      <label v-bind:for="field.key + '-' + index">Update field</label>
                    </div>
                    <textarea v-bind:rows="field.title === 'content' ? 15 : 2" v-model="field.value"></textarea>
                  </div>
                  <div class="checkboxes-container" v-if="field.type === 'checkboxes'">
                    <div class="checkbox" v-for="checkbox in field.values">
                      <div class="title-checkbox-group">
                        {{checkbox.title}}
                        <div class="form-group" v-bind:class="{'selected': checkbox.needUpdate}">
                          <input type="checkbox" v-bind:id="checkbox.key + '-' + index" v-model="checkbox.needUpdate">
                          <label v-bind:for="checkbox.key + '-' + index">Update field</label>
                        </div>
                      </div>
                      <input type="checkbox" v-model="checkbox.value">
                    </div>
                  </div>
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </div>

      <button v-bind:disabled="requestInProgress" v-if="files && files.length" v-on:click="generateResult">Generate result</button>
      <div class="result">
        {{updateResult}}
      </div>
      <button v-bind:disabled="requestInProgress" v-if="updateResult" v-on:click="updatePage">Update pages</button>
      <div class="log-container">
        <div class="log" v-bind:class="log.type" v-for="log in logs" v-html="log.message">
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
  .files-table .icon {
    width: 100px;
    height: 100px;
    background-size: contain;
  }
  .files-table td {
    padding: 0 10px;
    border-right: 2px solid black;
  }
  .files-table .file-info td {
    padding: 10px;
    border-bottom: 2px solid black;
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
      fileName: '',
      files: [],
      requestInProgress: false,
      updateResult: null,
      logs: []
    }
  },
  methods: {
    searchFiles() {
      this.requestInProgress = true;
      this.updateResult = null;
      this.logs = [];
      this.files = [];
      const params = CookiesService.setAuthParams({fileName: this.fileName});
      axios.get('/search-files', {params}).then(({data} = {}) => {
        this.files = data.files || [];
        this.files.forEach((file) => {
          const params = CookiesService.setAuthParams({page: file.editUrl});
          axios.get('/page-info',  {params}).then(({data}) => {
            file.fields = Object.keys(data.preparedFields).reduce((result, key) => {
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
            this.files = [...this.files];
          });
        });
      }).finally(() => {
        this.requestInProgress = false;
      });
    },
    generateResult() {
      this.updateResult = this.files.map((file) => {
        const updateFields = file.fields.reduce((result, field) => {
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
        if (Object.keys(updateFields).length) {
          return {
            editUrl: file.editUrl,
            updateFields
          }
        }
        return null;
      }).filter((item) => {
        return !!item;
      });
      this.updateResult = this.updateResult.length ? this.updateResult : null;
    },
    updatePage() {
      this.logs = [];
      const files = [...[], ...this.updateResult];
      const next = () => {
        const file = files.shift();
        if (file) {
          const params = CookiesService.setAuthParams({page: file.editUrl});
          const body = {
            newValues: file.updateFields
          };
          axios.post('/update-one-page', body, {params}).then(({data} = {}) => {
            this.logs.push({message: file.editUrl + ' ' + data, type: 'success'})
          }).catch(() => {
            this.logs.push({message: err, type: 'error'})
          }).finally(() => {
            next();
          });
        } else {
          this.logs.push({message: 'Update success', type: 'end'})
          this.requestInProgress = false;
        }
      }

      next();
    }
  },
  mounted: () => {
  }
}
</script>