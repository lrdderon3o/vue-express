
const prefix = 'cms_h';
const serverCookiesKey = prefix + '_cookies';

class CookiesService {

    getServerCookies() {
        return localStorage.getItem(serverCookiesKey) || '';
    }

    setServerCookies(data) {
        localStorage.setItem(serverCookiesKey, data);
    }

    setAuthParams(params = {}) {
       params.auth = this.getServerCookies();
       return params;
    }

}

export default new CookiesService();