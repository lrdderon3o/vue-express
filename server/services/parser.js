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

    getPreparedPageEditJSON(data) {
        const sanitizeFields = ['snippet[content]', 'snippet[label]', 'page[blocks_attributes][0][content]', 'page[label]'];
        const prepareValues = sanitizeFields.reduce((result, field) => {
            result[field] = this.desanitize
            return result;
        }, {});

        const prepared = {
            locales: data.mirrors.map((locale) => {
                return Object.keys(locale)[0];
            }),
            fields: this.getPreparedBody(data.html, {}, prepareValues, true)
        };

        prepared.preparedFields = Object.keys(prepared.fields).reduce((result, key) => {

            const getInsideBracketsRegexp = new RegExp(/\[(.*?)\]/, 'g');
            const replaceBracketsRegexp = /[\[\]]/g;

            if (key.indexOf('[category_ids]') !== -1) {
                const categoryIdRegexp = new RegExp(/\[([0-9]*)\]/, 'g');
                const categoryId = key.match(categoryIdRegexp)[0].replace(replaceBracketsRegexp, '');
                result['categories'] = result['categories'] || {};
                const checkboxTitle = data.html.querySelector(`[name='${key}']`);
                result['categories'][categoryId] = result['categories'][categoryId] || {
                    key,
                    title: checkboxTitle && checkboxTitle.nextElementSibling.rawText.replace(/\n/g, '')
                };
                result['categories'][categoryId].value = prepared.fields[key];
            } else if (key.indexOf('snippet[') !== -1) {
                const title = key.match(getInsideBracketsRegexp)[0].replace(replaceBracketsRegexp, '');
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
                value: published
            }
        }

        return prepared;
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
                    // Content-Type: application/octet-stream
                    // console.log(type);
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
        // const body = "------WebKitFormBoundarySwQb9c8whheicsBn\r\nContent-Disposition: form-data; name=\"utf8\"\r\n\r\n✓\r\n------WebKitFormBoundarySwQb9c8whheicsBn\r\nContent-Disposition: form-data; name=\"_method\"\r\n\r\npatch\r\n------WebKitFormBoundarySwQb9c8whheicsBn\r\nContent-Disposition: form-data; name=\"authenticity_token\"\r\n\r\ntjDjpIYodobBDUB+8uwpNIyy9EYyk9L3KA9++ZJckW6yMk3JGWfqn8/DvArlQhxsgrxwEUdRtk8rwI1XL7DnYA==\r\n------WebKitFormBoundarySwQb9c8whheicsBn\r\nContent-Disposition: form-data; name=\"page[label]\"\r\n\r\nTable Games\r\n------WebKitFormBoundarySwQb9c8whheicsBn\r\nContent-Disposition: form-data; name=\"page[slug]\"\r\n\r\ntable_games\r\n------WebKitFormBoundarySwQb9c8whheicsBn\r\nContent-Disposition: form-data; name=\"page[layout_id]\"\r\n\r\n4\r\n------WebKitFormBoundarySwQb9c8whheicsBn\r\nContent-Disposition: form-data; name=\"page[parent_id]\"\r\n\r\n49\r\n------WebKitFormBoundarySwQb9c8whheicsBn\r\nContent-Disposition: form-data; name=\"page[target_page_id]\"\r\n\r\n\r\n------WebKitFormBoundarySwQb9c8whheicsBn\r\nContent-Disposition: form-data; name=\"page[category_ids][679]\"\r\n\r\n0\r\n------WebKitFormBoundarySwQb9c8whheicsBn\r\nContent-Disposition: form-data; name=\"page[category_ids][18]\"\r\n\r\n0\r\n------WebKitFormBoundarySwQb9c8whheicsBn\r\nContent-Disposition: form-data; name=\"page[category_ids][108]\"\r\n\r\n0\r\n------WebKitFormBoundarySwQb9c8whheicsBn\r\nContent-Disposition: form-data; name=\"page[category_ids][180]\"\r\n\r\n0\r\n------WebKitFormBoundarySwQb9c8whheicsBn\r\nContent-Disposition: form-data; name=\"page[category_ids][111]\"\r\n\r\n0\r\n------WebKitFormBoundarySwQb9c8whheicsBn\r\nContent-Disposition: form-data; name=\"page[category_ids][110]\"\r\n\r\n0\r\n------WebKitFormBoundarySwQb9c8whheicsBn\r\nContent-Disposition: form-data; name=\"page[category_ids][109]\"\r\n\r\n0\r\n------WebKitFormBoundarySwQb9c8whheicsBn\r\nContent-Disposition: form-data; name=\"page[category_ids][382]\"\r\n\r\n0\r\n------WebKitFormBoundarySwQb9c8whheicsBn\r\nContent-Disposition: form-data; name=\"page[category_ids][19]\"\r\n\r\n0\r\n------WebKitFormBoundarySwQb9c8whheicsBn\r\nContent-Disposition: form-data; name=\"page[category_ids][20]\"\r\n\r\n0\r\n------WebKitFormBoundarySwQb9c8whheicsBn\r\nContent-Disposition: form-data; name=\"page[blocks_attributes][0][content]\"\r\n\r\n\r\n------WebKitFormBoundarySwQb9c8whheicsBn\r\nContent-Disposition: form-data; name=\"page[blocks_attributes][0][identifier]\"\r\n\r\ncontent\r\n------WebKitFormBoundarySwQb9c8whheicsBn\r\nContent-Disposition: form-data; name=\"page[blocks_attributes][1][content]\"\r\n\r\nTable Games Online Casino\r\n------WebKitFormBoundarySwQb9c8whheicsBn\r\nContent-Disposition: form-data; name=\"page[blocks_attributes][1][identifier]\"\r\n\r\ntitle\r\n------WebKitFormBoundarySwQb9c8whheicsBn\r\nContent-Disposition: form-data; name=\"page[blocks_attributes][2][content]\"\r\n\r\n\r\n------WebKitFormBoundarySwQb9c8whheicsBn\r\nContent-Disposition: form-data; name=\"page[blocks_attributes][2][identifier]\"\r\n\r\nkeywords\r\n------WebKitFormBoundarySwQb9c8whheicsBn\r\nContent-Disposition: form-data; name=\"page[blocks_attributes][3][content]\"\r\n\r\nTable Games ★ WildTornado ✔ 3000+ Hottest Games ✔ Welcome offer UP to €300/0.03BTC and 150 Free Spins ✔ Fastest Withdrawal Process 🎁\r\n------WebKitFormBoundarySwQb9c8whheicsBn\r\nContent-Disposition: form-data; name=\"page[blocks_attributes][3][identifier]\"\r\n\r\ndescription\r\n------WebKitFormBoundarySwQb9c8whheicsBn\r\nContent-Disposition: form-data; name=\"page[is_published]\"\r\n\r\n0\r\n------WebKitFormBoundarySwQb9c8whheicsBn\r\nContent-Disposition: form-data; name=\"page[is_published]\"\r\n\r\n1\r\n------WebKitFormBoundarySwQb9c8whheicsBn\r\nContent-Disposition: form-data; name=\"commit\"\r\n\r\nUpdate Page\r\n------WebKitFormBoundarySwQb9c8whheicsBn--\r\n";
        // const body = "------WebKitFormBoundaryWx2CZwAiGxE19IMN\r\nContent-Disposition: form-data; name=\"utf8\"\r\n\r\n✓\r\n------WebKitFormBoundaryWx2CZwAiGxE19IMN\r\nContent-Disposition: form-data; name=\"_method\"\r\n\r\npatch\r\n------WebKitFormBoundaryWx2CZwAiGxE19IMN\r\nContent-Disposition: form-data; name=\"authenticity_token\"\r\n\r\nGbLrChA/lfzMx06TxNW+ExUT6hkAMg4uKGjwx2N/EDYdsEVnj3AJ5cIJsufTe4tLGx1uTnXwapYrpwNp3pNmOA==\r\n------WebKitFormBoundaryWx2CZwAiGxE19IMN\r\nContent-Disposition: form-data; name=\"page[label]\"\r\n\r\nTable Games\r\n------WebKitFormBoundaryWx2CZwAiGxE19IMN\r\nContent-Disposition: form-data; name=\"page[slug]\"\r\n\r\ntable_games\r\n------WebKitFormBoundaryWx2CZwAiGxE19IMN\r\nContent-Disposition: form-data; name=\"page[layout_id]\"\r\n\r\n4\r\n------WebKitFormBoundaryWx2CZwAiGxE19IMN\r\nContent-Disposition: form-data; name=\"page[parent_id]\"\r\n\r\n49\r\n------WebKitFormBoundaryWx2CZwAiGxE19IMN\r\nContent-Disposition: form-data; name=\"page[target_page_id]\"\r\n\r\n\r\n------WebKitFormBoundaryWx2CZwAiGxE19IMN\r\nContent-Disposition: form-data; name=\"page[category_ids][679]\"\r\n\r\n0\r\n------WebKitFormBoundaryWx2CZwAiGxE19IMN\r\nContent-Disposition: form-data; name=\"page[category_ids][18]\"\r\n\r\n0\r\n------WebKitFormBoundaryWx2CZwAiGxE19IMN\r\nContent-Disposition: form-data; name=\"page[category_ids][108]\"\r\n\r\n0\r\n------WebKitFormBoundaryWx2CZwAiGxE19IMN\r\nContent-Disposition: form-data; name=\"page[category_ids][180]\"\r\n\r\n0\r\n------WebKitFormBoundaryWx2CZwAiGxE19IMN\r\nContent-Disposition: form-data; name=\"page[category_ids][111]\"\r\n\r\n0\r\n------WebKitFormBoundaryWx2CZwAiGxE19IMN\r\nContent-Disposition: form-data; name=\"page[category_ids][110]\"\r\n\r\n0\r\n------WebKitFormBoundaryWx2CZwAiGxE19IMN\r\nContent-Disposition: form-data; name=\"page[category_ids][109]\"\r\n\r\n0\r\n------WebKitFormBoundaryWx2CZwAiGxE19IMN\r\nContent-Disposition: form-data; name=\"page[category_ids][382]\"\r\n\r\n0\r\n------WebKitFormBoundaryWx2CZwAiGxE19IMN\r\nContent-Disposition: form-data; name=\"page[category_ids][19]\"\r\n\r\n0\r\n------WebKitFormBoundaryWx2CZwAiGxE19IMN\r\nContent-Disposition: form-data; name=\"page[category_ids][20]\"\r\n\r\n0\r\n------WebKitFormBoundaryWx2CZwAiGxE19IMN\r\nContent-Disposition: form-data; name=\"page[blocks_attributes][0][content]\"\r\n\r\n\r\n------WebKitFormBoundaryWx2CZwAiGxE19IMN\r\nContent-Disposition: form-data; name=\"page[blocks_attributes][0][identifier]\"\r\n\r\ncontent\r\n------WebKitFormBoundaryWx2CZwAiGxE19IMN\r\nContent-Disposition: form-data; name=\"page[blocks_attributes][1][content]\"\r\n\r\nTable Games Online Casino\r\n------WebKitFormBoundaryWx2CZwAiGxE19IMN\r\nContent-Disposition: form-data; name=\"page[blocks_attributes][1][identifier]\"\r\n\r\ntitle\r\n------WebKitFormBoundaryWx2CZwAiGxE19IMN\r\nContent-Disposition: form-data; name=\"page[blocks_attributes][2][content]\"\r\n\r\n\r\n------WebKitFormBoundaryWx2CZwAiGxE19IMN\r\nContent-Disposition: form-data; name=\"page[blocks_attributes][2][identifier]\"\r\n\r\nkeywords\r\n------WebKitFormBoundaryWx2CZwAiGxE19IMN\r\nContent-Disposition: form-data; name=\"page[blocks_attributes][3][content]\"\r\n\r\nTable Games ★ WildTornado ✔ 3000+ Hottest Games ✔ Welcome offer UP to €300/0.03BTC and 150 Free Spins ✔ Fastest Withdrawal Process 🎁\r\n------WebKitFormBoundaryWx2CZwAiGxE19IMN\r\nContent-Disposition: form-data; name=\"page[blocks_attributes][3][identifier]\"\r\n\r\ndescription\r\n------WebKitFormBoundaryWx2CZwAiGxE19IMN\r\nContent-Disposition: form-data; name=\"page[is_published]\"\r\n\r\n0\r\n------WebKitFormBoundaryWx2CZwAiGxE19IMN\r\nContent-Disposition: form-data; name=\"page[is_published]\"\r\n\r\n1\r\n------WebKitFormBoundaryWx2CZwAiGxE19IMN\r\nContent-Disposition: form-data; name=\"commit\"\r\n\r\nUpdate Page\r\n------WebKitFormBoundaryWx2CZwAiGxE19IMN--\r\n";

        // console.log(form);
        // console.log('----------------');
        // console.log(body);

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

