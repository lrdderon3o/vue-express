<template>
  <div class="page page--index">
    <h3>Edit page/snippet</h3>
    Page url: <input type="text" v-model="url" placeholder="Page url">
    <button v-bind:disabled="requestInProgress" v-on:click="getPage()">Get page</button>
  </div>
</template>

<script>

import axios from 'axios';
import CookiesService from '../services/cookies.service';

export default {
  components: {
  },
  data: function() {
    return {
      url: '',
      requestInProgress: false
    }
  },
  methods: {
    getPage() {
      this.requestInProgress = true;
      const params = CookiesService.setAuthParams({page: this.url});
      axios.get('/page-info', {params}).then((response) => {
        console.log('/page-info', response.data);
      }).finally(() => {
        this.requestInProgress = false;
      });
      // https://wildtornado.casino-backend.com/backend/cms/sites/4/pages/2897/edit
    }
  },
  mounted: () => {
    const eventSource = new EventSource('digits');
    eventSource.onopen = (e) => {
      console.log("Event: open");
    };
    eventSource.onerror = function(e) {
      console.log("Event: error", e);
      if (this.readyState == EventSource.CONNECTING) {
        console.log(`Reconnecting (readyState=${this.readyState})...`);
      } else {
        console.log("Error has occured.");
      }
    };
    eventSource.addEventListener('message', message => {
      console.log('Got', message);
      if (message.data === 'close') {
        eventSource.close();
      }
    });
  }
}
</script>