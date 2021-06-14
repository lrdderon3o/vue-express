const express = require('express');
const app = express();
const Parser = require('../services/parser');

const longPoolRequests = {};
const setLongPoolRequest = (key, value) => {
    longPoolRequests[key] = value;
};
const getLongPoolRequest = (key) => {
    return longPoolRequests[key];
};
const removeLongPoolRequest = (key) => {
    delete longPoolRequests[key];
};

const getFilesMirrors = (parser) => {
    const pageUrl = '/backend/cms/sites/4/files';
    return parser.getPage(pageUrl).then(({mirrors}) => {
        return mirrors.map((lang) => {
            return Object.values(lang)[0].replace('/edit', '');
        });
    });
}

const collectFilesPages = (parser, pageUrl) => {
    const filesPages = [];
    return new Promise((resolve, reject) => {
        parser.getPage(pageUrl).then((page) => {
            const paginationLinks = page.html.querySelectorAll(`a[href^="${pageUrl}?page="]`);
            const paginationPages = paginationLinks.map((item) => {
                return String(item.rawAttributes.href || '').split('page=')[1];
            }).filter((item) => {
                return !!item;
            }).map((item) => {
                return +item;
            });
            const maxPage = Math.max.apply(null, paginationPages);

            for (let i = 1; i <= maxPage; i++) {
                filesPages.push(pageUrl + '?page=' + i);
            }
            resolve(filesPages);
        }).catch((err) => {
            reject(err);
        });
    });
}

const collectFilesFromPage = (parser, filesPages) => {

    const files = [];

    return new Promise((resolve, reject) => {

        const next = () => {
            const filesPageUrl = filesPages.shift();
            if (filesPageUrl) {
                parser.getPage(filesPageUrl).then((page) => {
                    const rows = page.html.querySelectorAll('[id^=comfy_cms_file]');
                    rows.forEach((row) => {
                        const fileId = +row.rawAttributes.id.replace('comfy_cms_file_', '');
                        if (fileId) {
                            const icon = row.querySelector('.icon');
                            const titleItem = row.querySelector('.item-title');
                            const titleLink = titleItem && titleItem.querySelector('a');
                            const fileObj = {
                                fileId,
                                icon: icon && parser.desanitize(icon.rawAttributes.style),
                                title: titleLink && parser.desanitize(titleLink.innerText),
                                editUrl: titleLink && parser.desanitize(titleLink.rawAttributes.href)
                            };
                            if (fileObj.icon) {
                                const searchValue = '/system/comfy/cms/';
                                fileObj.icon = fileObj.icon.replace(searchValue, parser.requestSettings.domain + searchValue)
                            }
                            files.push(fileObj);
                        }
                    });
                    next();
                }).catch((err) => {
                    console.error('Can`t get files page url', err);
                    next();
                })
            } else {
             resolve(files)
            }
        }

        next();

    });
}

app.get('/page-info', (req, res) => {
    const {page, auth} = req.query || {};
    if (page && auth) {
        const splitter = '/backend';
        const [domain, pageUrl] = page.split(splitter);
        const parser = new Parser(domain, auth);
        parser.getPage(splitter + pageUrl).then((data) => {
            res.json(parser.getPreparedPageEditJSON(data));
        }).catch(() => {
            res.status(500).send('Get page error');
        })
    } else {
        res.status(500).send('Auth error')
    }
});

app.get('/collect-pages', (req, res) => {
    const {auth, snippets} = req.query || {};
    if (auth) {
        const page = `https://wildtornado.casino-backend.com/backend/cms/sites/4/${+snippets ? 'snippets' : 'pages'}`;
        const splitter = '/backend';
        const [domain, pageUrl] = page.split(splitter);
        const parser = new Parser(domain, auth);
        parser.getPage(splitter + pageUrl).then((data) => {
            const rows = data.html.querySelectorAll('[id^=comfy_cms_]');
            const pages = [];
            rows.forEach((row) => {
               const titleElem = row.querySelector('.item-title');
               const metaElem = row.querySelector('.item-meta');

               if (titleElem && metaElem) {
                   const categories = titleElem.querySelectorAll('.category').map((categoryElem) => {
                        categoryElem.remove();
                        return categoryElem.innerText;
                   });
                   const {'id': rowId} = row.rawAttributes;
                   const [type, id] = rowId.replace('comfy_cms_', '').split('_');
                   const url = `https://wildtornado.casino-backend.com/backend/cms/sites/4/${type}s/${id}/edit`
                   pages.push({
                       title: parser.desanitize(titleElem.innerText).trim(),
                       meta: parser.desanitize(metaElem.innerText).trim(),
                       categories,
                       url
                   })
               }
            });
            res.json({data: pages});
        }).catch(() => {
            res.status(500).send('Get general page error');
        })
    } else {
        res.status(500).send('Auth error')
    }
});

app.get('/search-files', (req, res) => {
    const {fileName, auth} = req.query || {};
    if (fileName && auth) {
        const parser = new Parser(null, auth);
        getFilesMirrors(parser).then((mirrors = []) => {
            let filesPages = [];

            const next = () => {
                const mirror = mirrors.shift();
                if (mirror) {
                    collectFilesPages(parser, mirror).then((mirrorPages) => {
                        if (mirrorPages.length) {
                            filesPages = [...filesPages, ...mirrorPages];
                        } else {
                            filesPages.push(mirror);
                        }
                        next();
                    }).catch(() => {
                        next();
                    })
                } else {
                    collectFilesFromPage(parser, filesPages).then((files) => {
                        const searchedFiles = files.filter((file) => {
                            return String(file.title).toLowerCase().indexOf(fileName.toLowerCase()) !== -1 ||
                            String(file.icon).toLowerCase().indexOf(fileName.toLowerCase()) !== -1;
                        })
                        res.json({...{files: searchedFiles}});
                    }).catch(() => {
                        res.status(500).send('Collect files from pages error');
                    })
                }
            }

            next();

        }).catch(() => {
            res.status(500).send('Get files mirrors error');
        });
    } else {
        res.status(500).send('Auth error')
    }
});

app.post('/update-page', (req, res) =>  {
    const {page, auth} = req.query || {};
    if (page && auth) {
        const splitter = '/backend';
        const [domain, pageUrl] = page.split(splitter);
        const parser = new Parser(domain, auth);
        parser.getPage(splitter + pageUrl).then((data) => {
            const {locales, newValues, script} = req.body;
            const longPoolRequest = parser.getLongPoolRequest(newValues, locales, data, script);
            setLongPoolRequest(page, longPoolRequest);
            res.json({requestId: page});
        }).catch(() => {
            res.status(500).send('Get page error');
        })
    } else {
        res.status(500).send('Auth error')
    }
});

app.post('/update-one-page', (req, res) =>  {
    const {page, locale, auth} = req.query || {};
    if (page && auth) {
        const splitter = '/backend';
        let [domain, pageUrl] = page.split(splitter);
        const parser = new Parser(domain, auth);
        let {newValues} = req.body;
        parser.getPage(splitter + pageUrl).then((page) => {
            if (locale) {
                const localeInMirrors = Object.keys(page.mirrors).find((mirrorLocale) => {
                    return page.mirrors[mirrorLocale].toLowerCase() === locale.toLowerCase();
                });
                if (localeInMirrors) {
                    pageUrl = page.mirrors[localeInMirrors];
                }
            }
            const body = parser.getPreparedBody(page.html, newValues, parser.defaultSanitize);
            parser.updatePage(splitter + pageUrl.replace('/edit', ''), body).then(() => {
                res.json('Update done');
            }).catch(() => {
                res.status(500).send('Update page error');
            })
        }).catch(() => {
            res.status(500).send('Get page error');
        })
    } else {
        res.status(500).send('Auth error')
    }
});

app.get('/apply-request',  async (req, res) => {
    const {requestId} = req.query || {};
    const requestData = getLongPoolRequest(requestId);

    if (requestData) {
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.flushHeaders(); // flush the headers to establish SSE with client

        const parser = new Parser(requestData.domain, requestData.cookie);

        parser.applyRequest(requestData, res, () => {
            removeLongPoolRequest(requestId);
        });

    } else {
        res.status(500).send('Request not found');
    }

});

module.exports = app;