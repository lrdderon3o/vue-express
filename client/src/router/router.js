import Vue from 'vue';
import VueRouter from 'vue-router';
import IndexPage from '../pages/IndexPage.vue';
import FilesPage from '../pages/FilesPage.vue';
import ApplyMigrations from '../pages/ApplyMigrations.vue';
import SearchUsed from '../pages/SearchUsed.vue';
import NotFound from '../pages/404.vue';

Vue.use(VueRouter);
const router = new VueRouter({
  routes: [
    { path: '/', component: IndexPage },
    { path: '/files', component: FilesPage },
    { path: '/apply-migrations', component: ApplyMigrations },
    { path: '/search-used', component: SearchUsed },
    { path: '*', component: NotFound }
  ]
});

export default router;
