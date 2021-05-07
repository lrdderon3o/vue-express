const fetch = require('node-fetch');
const { parse } = require('node-html-parser');

module.exports = class Parser {

    constructor(domain, cookie) {
        this.requestSettings = {
            domain,
            cookie,
            boundary: 'WebKitFormBoundaryFX2wOJjgGzdfLVZb'
        };
    }

    desanitize(string) {
        let ret = String(string).replace(/&gt;/g, '>');
        ret = ret.replace(/&amp;gt/g, '>');
        ret = ret.replace(/&lt;/g, '<');
        ret = ret.replace(/&amp;lt;/g, '<');
        ret = ret.replace(/&amp;/g, '&');
        ret = ret.replace(/&quot;/g, '"');
        ret = ret.replace(/&apos;/g, "'");
        ret = ret.replace(/&#x000A;/g, '\r\n');
        ret = ret.replace(/&#39;/g, '\'');
        ret = ret.replace(/>;/g, '>');
        ret = ret.replace(/&#x0020;/g, ' ');
        return ret;
    };

    get defaultSanitize() {
        const sanitizeFields = ['snippet[content]', 'snippet[label]', 'page[blocks_attributes][0][content]', 'page[label]'];
        return sanitizeFields.reduce((result, field) => {
            result[field] = this.desanitize
            return result;
        }, {});
    }

    getPreparedPageEditJSON(data) {
        const prepared = {
            locales: data.mirrors.map((locale) => {
                return Object.keys(locale)[0];
            }),
            fields: this.getPreparedBody(data.html, {}, this.defaultSanitize, true)
        };

        prepared.preparedFields = Object.keys(prepared.fields).reduce((result, key) => {

            const idRegexp = new RegExp(/\[([0-9]*)\]/, 'g');
            const getInsideBracketsRegexp = new RegExp(/\[(.*?)\]/, 'g');
            const replaceBracketsRegexp = /[\[\]]/g;
            const simpleFields = ['page[label]', 'page[slug]'];

            if (key.indexOf('[category_ids]') !== -1) {
                const categoryId = key.match(idRegexp)[0].replace(replaceBracketsRegexp, '');
                result['categories'] = result['categories'] || {};
                const checkboxTitle = data.html.querySelector(`[name='${key}']`);
                result['categories'][categoryId] = result['categories'][categoryId] || {
                    key,
                    title: checkboxTitle && checkboxTitle.nextElementSibling.rawText.replace(/\n/g, '')
                };
                result['categories'][categoryId].value = +prepared.fields[key];
            } else if (key.indexOf('snippet[') !== -1 || simpleFields.indexOf(key) !== -1) {
                const title = key.match(getInsideBracketsRegexp)[0].replace(replaceBracketsRegexp, '');
                result[title] = result[title] || {
                    key,
                    title
                };
                result[title].value = prepared.fields[key];
            } else if (key.indexOf('page[blocks_attributes]') !== -1 && key.indexOf('[content]') !== -1) {
                const identifier = key.replace('[content]', '[identifier]');
                const title = prepared.fields[identifier];
                result[title] = result[title] || {
                    key,
                    title
                };
                result[title].value = prepared.fields[key];
            }

            return result;
        }, {});

        const publishedCheckboxes = data.html.querySelectorAll('[name="page[is_published]"]');
        if (publishedCheckboxes.length) {
            const published = publishedCheckboxes[publishedCheckboxes.length - 1].rawAttributes.value;
            prepared.preparedFields.published = {
                key: 'page[is_published]',
                title: 'published',
                value: +published
            }
        }

        return prepared;
    }

    getLongPoolRequest(newValues, locales, page) {
        return {
            page,
            domain: this.requestSettings.domain,
            cookie: this.requestSettings.cookie,
            newValues,
            pages: locales.map((locale) => {
                const pageLocale = page.mirrors.find((mirror) => {
                    return locale in mirror;
                });
                if (pageLocale) {
                    return {
                        locale,
                        pageUrl: Object.values(pageLocale)[0]
                    }
                }
            }).filter(i => i)
        }
    }

    applyRequest(requestData, response, closeCallback) {
        const {pages, newValues} = requestData;

        const log = (message, type = 'success') => {
            response.write(`data: ${JSON.stringify({message, type})}\n\n`);
        };

        const close = () => {
            response.end('data: close\n\n');
            closeCallback();
        }

        const next = () => {
            const childPage = pages.shift();
            if (childPage) {
                const {locale, pageUrl} = childPage;
                log(`Start edit page ${pageUrl} (${locale})`);
                this.getPage(pageUrl).then((page) => {
                    log(`Success get page`);
                    const body = this.getPreparedBody(page.html, newValues, this.defaultSanitize);
                    this.updatePage(pageUrl.replace('/edit', ''), body).then(() => {
                        log(`Success update page`);
                        next();
                    })
                }).catch((error) => {
                    log(`ERROR EDIT PAGE ${pageUrl} (${locale})`, 'error');
                    next();
                });
            } else {
                close();
            }
        }
        next();
    }

    getPage(page) {
        return fetch(`${this.requestSettings.domain}${page}`, {
            "headers": {
                "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
                "accept-language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7,uk;q=0.6",
                "cache-control": "no-cache",
                "pragma": "no-cache",
                "sec-ch-ua": "\"Google Chrome\";v=\"89\", \"Chromium\";v=\"89\", \";Not A Brand\";v=\"99\"",
                "sec-ch-ua-mobile": "?0",
                "sec-fetch-dest": "document",
                "sec-fetch-mode": "navigate",
                "sec-fetch-site": "same-origin",
                "sec-fetch-user": "?1",
                "upgrade-insecure-requests": "1",
                "cookie": this.requestSettings.cookie
            },
            "referrer": `${this.requestSettings.domain}${page}`,
            "referrerPolicy": "strict-origin-when-cross-origin",
            "body": null,
            "method": "GET",
            "mode": "cors"
        })
            .then((res) => res.text())
            .then((page) => {
                const html = parse(page);
                const mirrorsElement = html.querySelector('#mirror');
                const mirrors = mirrorsElement && mirrorsElement.querySelectorAll('option').map((option) => {
                    const language = option.rawText.split('(')[1].split(',')[0].replace(')', '');
                    return {
                        [language]: option.rawAttributes.value
                    };
                });
                return {
                    mirrors,
                    html
                }
            }).catch((error) => {
            console.log(error);
        });
    }

    getPreparedBody(html, newValues, prepareValues, json = false) {
        const ignoreKeys = ['preview'];
        const jsonData = {};
        let stringData = ``;
        [].forEach.call(html.querySelector('form').querySelectorAll('input,select,textarea'), (node) => {
            let {name, value, checked, type} = node.rawAttributes;
            if (ignoreKeys.indexOf(name) === -1) {
                if (type === 'checkbox') {
                    value = +!!checked;
                    if (!value) {
                        return;
                    }
                } else if (node.rawTagName === 'select') {
                    const selectedOption = node.querySelectorAll('option').find((option) => {
                        return option.rawAttributes.selected;
                    });
                    value = selectedOption ? +selectedOption.rawAttributes.value : null;
                } else if (node.rawTagName === 'textarea') {
                    const [text] = node.childNodes;
                    value = text ? text.rawText.trim() : null;
                }

                value = value === null || value === undefined ? '' : value;

                if (name in newValues) {
                    value = newValues[name];
                }

                if (prepareValues && name in prepareValues) {
                    value = prepareValues[name](value);
                }
                const getFileContent = () => {
                    if (type === 'file') {
                        if (newValues.fileDescription) {
                            return `; filename="${newValues.fileDescription.filename}"\r\nContent-Type: ${newValues.fileDescription.type}`;
                        }
                        return '; filename=""\r\nContent-Type: application/octet-stream';
                    }
                    return '';
                }
                jsonData[name] = value;
                const stringItem = '------' + this.requestSettings.boundary + '\r\nContent-Disposition: form-data; name="' + name + '"' + getFileContent() + '\r\n\r\n' + value + '\r\n';
                stringData += stringItem;

            }
        });

        stringData += '------' + this.requestSettings.boundary + '--';

        // console.log(stringData);
        if (json) {
            return jsonData;
        }
        return stringData;
    }

    updatePage(page, form) {
        return fetch(`${this.requestSettings.domain}${page}`, {
            "headers": {
                "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
                "accept-language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7,uk;q=0.6",
                "cache-control": "max-age=0",
                "content-type": `multipart/form-data; boundary=----${this.requestSettings.boundary}`,
                "sec-fetch-dest": "document",
                "sec-fetch-mode": "navigate",
                "sec-fetch-site": "same-origin",
                "sec-fetch-user": "?1",
                "upgrade-insecure-requests": "1",
                "cookie": this.requestSettings.cookie
            },
            "referrer": `${this.requestSettings.domain}${page}/edit`,
            "referrerPolicy": "strict-origin-when-cross-origin",
            "body": form,
            // "body": body,
            "method": "POST",
            "mode": "cors"
        });
    }

    updateFile(page, form) {
        return fetch(`${this.requestSettings.domain}${page}`, {
            "headers": {
                "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
                "accept-language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7,uk;q=0.6",
                "cache-control": "no-cache",
                "content-type": `multipart/form-data; boundary=----${this.requestSettings.boundary}`,
                "pragma": "no-cache",
                "sec-ch-ua": "\"Google Chrome\";v=\"89\", \"Chromium\";v=\"89\", \";Not A Brand\";v=\"99\"",
                "sec-ch-ua-mobile": "?0",
                "sec-fetch-dest": "document",
                "sec-fetch-mode": "navigate",
                "sec-fetch-site": "same-origin",
                "sec-fetch-user": "?1",
                "upgrade-insecure-requests": "1",
                "cookie": this.requestSettings.cookie
            },
            "referrer": `${this.requestSettings.domain}${page}/edit`,
            "referrerPolicy": "strict-origin-when-cross-origin",
            "body": form,
            "method": "POST",
            "mode": "cors"
        });
    }

};

