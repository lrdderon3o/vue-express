<template>
  <div class="page page--index">
    <h3>Search used snippets/files</h3>
    <button v-bind:disabled="requestInProgress" v-on:click="searchUsedSnippets()">Get used snippets</button>

    <div class="container">

<!--      <button v-bind:disabled="requestInProgress" v-if="files && files.length" v-on:click="generateResult">Generate result</button>-->
<!--      <div class="result">-->
<!--        {{updateResult}}-->
<!--      </div>-->
<!--      <button v-bind:disabled="requestInProgress" v-if="updateResult" v-on:click="updatePage">Update pages</button>-->
<!--      <div class="log-container">-->
<!--        <div class="log" v-bind:class="log.type" v-for="log in logs" v-html="log.message">-->
<!--        </div>-->
<!--      </div>-->

    </div>

  </div>
</template>

<style type="text/css">
  .container {
    display: flex;
    flex-direction: column;
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
      requestInProgress: false,
      logs: []
    }
  },
  methods: {
    searchUsedSnippets() {
      const params = CookiesService.setAuthParams();
      axios.get('/search-used/snippets', {params}).then(({data} = {}) => {

      }).catch(() => {
        this.logs.push({message: err, type: 'error'})
      });
    }
  },
  mounted: () => {
  }
}
</script>