<template>
  <div id="app">
    Cookies: <input type="text" v-model="cookies" v-on:change="saveCookies" placeholder="Cookies">
    <div class="description">
      Get cookies from any request from <a href="https://wildtornado.casino-backend.com/backend/cms">Backend</a>
    </div>
    <nav>
      <span>Navigation</span>
      <router-link to="/" exact>Edit page/snippet</router-link>
      <router-link to="/files" exact>Edit files</router-link>
      <router-link to="/apply-migrations" exact>Apply page/snippet migration</router-link>
    </nav>
    <router-view></router-view>
  </div>
</template>

<script>

import CookiesService from '../services/cookies.service';

export default {
  name: 'app',
  data:  () => {
    return {
      cookies: CookiesService.getServerCookies()
    }
  },
  methods: {
    saveCookies(e) {
      CookiesService.setServerCookies(this.cookies);
    }
  }
}
</script>