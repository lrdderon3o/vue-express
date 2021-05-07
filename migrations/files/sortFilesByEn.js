const parser = require('./../parser');

const parserClass = new parser(requestSettings);
// const allowedLangs = ['en', 'en-CA', 'en-NZ', 'en-AU', 'en-ZA', 'en-IE'];
// const allowedLangs = ['en-IE'];

const pageUrl = '/backend/cms/sites/4/files?category%5B%5D=slider-index-top';

const collectLinksFromPage = (page) => {
    const links = [];
    const [files] = page.html.querySelectorAll('.cms-uploader-filelist');
    if (files) {
        const filesLinkRows = files.querySelectorAll('tr');
        filesLinkRows.forEach((row) => {
            const rowColumns = row.querySelectorAll('td');
            const buttonsContainer = rowColumns[rowColumns.length - 1];
            if (buttonsContainer) {
                const editLink = buttonsContainer.querySelector('.btn.btn-default').rawAttributes.href;
                links.push(editLink);
            }
        })
    }
    return links;
};

const desanitize = (string) => {
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

const collectEnFilesContent = (links, callback) => {

    const content = [];

    const next = () => {
        const pageUrl = links.shift();
        if (pageUrl) {
            parserClass.getPage(pageUrl).then((page) => {
                const description = page.html.querySelector('#file_description');
                if (description) {
                    const [text] = description.childNodes;
                    content.push(text ? desanitize(text.rawText.trim()) : null);
                }
                next();
            }).catch((error) => {
                console.error('ERROR LOAD PAGE', error);
                next();
            });
        } else {
            callback(
                content
                    .filter(item => !!item)
                    .map(item => item.replace(/\r\n/g, ''))
            );
        }
    }

    next();
};

parserClass.getPage(pageUrl).then((page) => {

    const mirrors = page.mirrors
        // .filter((lang) => {
        //     return allowedLangs.indexOf(Object.keys(lang)[0]) !== -1;
        // })
        .map((lang) => {
            return Object.values(lang)[0].replace('/edit', '');
        });

    // console.log('mirrors', mirrors);

    const filesLinks = collectLinksFromPage(page);

    collectEnFilesContent(filesLinks, (content) => {
        content = content.map(item => item.replace(/\\\\/g, '\\').trim())
            .map(item => JSON.parse(item))
        // console.log('content', content); // TODO get mirrors and get similar files
        const nextMirror = () => {
            const mirror = mirrors.shift();
            if (mirror) {
                console.log('ACTIVE mirror', mirror);
                parserClass.getPage(mirror).then((mirrorPage) => {
                    const mirrorFilesLinks = collectLinksFromPage(mirrorPage);

                    let replaceFilesCount = 0;
                    const REMOVE = [];
                    const next = () => {
                        const fileUrl = mirrorFilesLinks.shift();
                        if (fileUrl) {
                            parserClass.getPage(fileUrl).then((page) => {
                                const description = page.html.querySelector('#file_description');
                                if (description) {
                                    const [text] = description.childNodes;
                                    let fileDescription = text ? desanitize(text.rawText.trim()) : null;
                                    if (fileDescription) {
                                        fileDescription = fileDescription.replace(/\r\n/g, '');
                                        let replaceTo = content.find(({description}) => {
                                            return fileDescription === description;
                                        });
                                        try {
                                            const jsonDescription = JSON.parse(fileDescription);
                                            replaceTo = content.find(({description}) => {
                                                return jsonDescription.description === description;
                                            });
                                        } catch (e) {

                                        }
                                        if (replaceTo) {
                                            const {name} = description.rawAttributes;
                                            replaceFilesCount++;
                                            const newValues = {
                                                'file[description]': JSON.stringify(replaceTo)
                                            };
                                            const body = parserClass.getPreparedBody(page.html, newValues);
                                            const valuesIdentical = fileDescription === JSON.stringify(replaceTo);
                                            if (valuesIdentical) {
                                                console.log('VALUES IDENTICAL');
                                                next();
                                            } else {
                                                parserClass.updateFile(fileUrl.replace('/edit', ''), body).then((data) => {
                                                    console.log('REPLACE : ' + name);
                                                    console.log('OLD VALUE : ', fileDescription);
                                                    console.log('NEW VALUE : ', JSON.stringify(replaceTo));
                                                    next();
                                                }).catch(() => {
                                                    console.error('UPDATE file error: ', fileUrl);
                                                })
                                            }
                                        } else {
                                            REMOVE.push(fileUrl);
                                            next();
                                            // console.error('REMOVE: ' + fileUrl);
                                        }
                                    }
                                } else {
                                    next();
                                }
                            }).catch((error) => {
                                console.error('ERROR LOAD FILE', error);
                                next();
                            });
                        } else {
                            console.log('REPLACED COUNT', replaceFilesCount);
                            console.log('ORIGINAL EN IMAGES COUNT', content.length)
                            console.log('REMOVE', REMOVE);
                            nextMirror();
                        }
                    }
                    next();

                }).catch(() => {
                    console.error('ERROR GET mirror');
                    nextMirror();
                });
            } else {
                console.log('END');

            }
        };
        nextMirror();
    })

    // console.log('filesLinks', filesLinks);

    // const newValues = {
    //     'page[is_published]': 0
    // };
    //
    // const prepareValues = {
    //     'page[blocks_attributes][0][content]': desanitize
    // };
    //
    // const next = () => {
    //     const childPageUrl = pages.shift();
    //     if (childPageUrl) {
    //         parserClass.getPage(childPageUrl + '/edit').then((page) => {
    //             const body = parserClass.getPreparedBody(page.html, newValues, prepareValues);
    //             parserClass.updatePage(childPageUrl, body).then((data) => {
    //                 console.log('Update success', childPageUrl);
    //                 next();
    //             })
    //         }).catch((error) => {
    //             console.error('ERROR EDIT PAGE', error);
    //             next();
    //         });
    //     }
    // };
    // next();

}).catch((error) => {
    console.error('ERROR LOAD PAGE', error);
});


