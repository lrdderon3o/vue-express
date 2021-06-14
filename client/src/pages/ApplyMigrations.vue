<template>
  <div class="page page--index">
    <h3>Apply page/snippet migration</h3>
    <button v-bind:disabled="requestInProgress" v-on:click="collectAllPages()">Collect all pages</button>
    <button v-bind:disabled="requestInProgress" v-on:click="collectAllPages(true)">Collect all snippets</button>

    <div class="container">

      <div class="pages" v-if="pages && pages.length">
        <h3>Pages list</h3>
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Meta</th>
              <th>Url</th>
              <th>Categories</th>
            </tr>
          </thead>
          <tbody>
            <tr class="page" v-for="page in pages">
              <td class="title">{{page.title}}</td>
              <td class="meta">{{page.meta}}</td>
              <td class="url">
                <a v-bind:href="page.url" target="_blank">{{page.url}}</a>
              </td>
              <td class="categories">{{page.categories}}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="script-container" v-if="pages && pages.length">
        <div class="desc">
          <pre>
            // Migration structure example (for page)
            {
              blizzard-royale: {
                cs: {
                  'page[blocks_attributes][1][content]' /* Title */: 'New title',
                  'page[blocks_attributes][3][content]' /* Description */: 'New description'
                },
                en: {
                  // The same
                }
              }
            }

          </pre>
        </div>
        <textarea placeholder="Migration" rows="16" v-model="migration"></textarea>
      </div>

      <button v-bind:disabled="requestInProgress" v-if="pages && pages.length" v-on:click="generateResult">Generate result</button>
<!--      <div class="result">-->
<!--        {{updateResult}}-->
<!--      </div>-->
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
      script: '',
      logs: [],
      pages: [],
      migration: ''
    }
  },
  methods: {
    collectAllPages(snippets = false) {
      this.requestInProgress = true;
      this.updateResult = null;
      this.logs = [];
      this.pages = [];
      const params = CookiesService.setAuthParams({snippets: +snippets});
      axios.get('/collect-pages', {params}).then(({data} = {}) => {
        this.pages = data.data;
      }).finally(() => {
        this.requestInProgress = false;
      });
    },
    generateResult() {
      let migrationObj = this.migration && JSON.parse(this.migration);
      migrationObj = typeof migrationObj === 'string' ? JSON.parse(migrationObj) : migrationObj;
      this.updateResult = null;
      if (migrationObj) {
        this.updateResult = Object.keys(migrationObj).reduce((result, pagePart) => {
          const page = this.pages.find(({meta}) => {
            return String(meta).toLowerCase().indexOf(pagePart.toLowerCase()) !== -1;
          });
          if (page) {
            Object.keys(migrationObj[pagePart]).forEach((locale) => {
              result.push({editUrl: page.url, locale, newValues: migrationObj[pagePart]});
            })
          }
          return result;
        }, []);
      }
    },
    updatePage() {
      this.pages = [];
      this.migration = '';
      this.requestInProgress = true;

      const spliceFromIndex = this.updateResult.findIndex(({editUrl}) => {
        return editUrl === 'https://wildtornado.casino-backend.com/backend/cms/sites/4/pages/2391/edit';
      });

      this.updateResult = this.updateResult.splice(spliceFromIndex, this.updateResult.length);

      const next = () => {
        const page = this.updateResult.shift();
        if (page) {
          const {editUrl, locale, newValues} = page;
          const body = {locale, newValues};
          const params = CookiesService.setAuthParams({page: editUrl});
          delete page.editUrl;
          axios.post('/update-one-page', body, {params}).then(({data} = {}) => {
            this.logs.push({message: editUrl + ' ' + data + ` (${body.locale})`, type: 'success'});
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