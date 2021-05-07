const parser = require('./../parser');


const parserClass = new parser(requestSettings);
// const allowedLangs = ['en', 'en-CA', 'en-NZ', 'en-AU', 'en-ZA', 'en-IE'];
const allowedLangs = ['en-IE'];

const pageUrl = '/backend/cms/sites/4/files?category%5B%5D=slider-index-top';

const getLinkFromPage = (page) => {
    const links = [];
    const [files] = page.html.querySelectorAll('.cms-uploader-filelist');
    if (files) {
        const filesLinkRows = files.querySelectorAll('tr');
        filesLinkRows.forEach((row) => {
            const rowColumns = row.querySelectorAll('td');
            const titleContainer = rowColumns[1];
            if (titleContainer && titleContainer.toString().indexOf('2450х700 Playson Cash Paradise') !== -1) {
                const buttonsContainer = rowColumns[rowColumns.length - 1];
                if (buttonsContainer) {
                    const editLink = buttonsContainer.querySelector('.btn.btn-default').rawAttributes.href;
                    links.push(editLink);
                }
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



parserClass.getPage(pageUrl).then((page) => {

    const mirrors = page.mirrors
        // .filter((lang) => {
        //     return allowedLangs.indexOf(Object.keys(lang)[0]) !== -1;
        // })
        .map((lang) => {
            return Object.values(lang)[0].replace('/edit', '');
        });

    // console.log('mirrors', mirrors);

    const [fileLink] = getLinkFromPage(page);

    parserClass.getPage(fileLink).then((filePage) => {
        const content = filePage.html.querySelector('#file_description');
        let value = null;
        if (content) {
            const [text] = content.childNodes;
            value = text ? desanitize(text.rawText.trim()) : null;
        }


        const next = () => {
            const mirror = mirrors.shift();
            if (mirror) {
                parserClass.getPage(mirror).then((filesPage) => {
                    const [fileLink] = getLinkFromPage(filesPage);
                    parserClass.getPage(fileLink).then((otherLocale) => {
                        const newValues = {
                            'file[description]': value
                        };
                        const body = parserClass.getPreparedBody(otherLocale.html, newValues);

                        parserClass.updateFile(fileLink.replace('/edit', ''), body).then((data) => {
                            console.log('File updated: ' + fileLink);
                            next();
                        }).catch(() => {
                            console.error('UPDATE file error: ', fileLink);
                            next();
                        })

                    }).catch(() => {
                        console.error('File page error', fileLink);
                        next();
                    })
                }).catch(() => {
                    console.error('Mirror page error', mirror);
                    next();
                })
            }
        }

        next();
    })

    // collectEnFilesContent(filesLinks, (content) => {
    //     content = content.map(item => item.replace(/\\\\/g, '\\').trim())
    //         .map(item => JSON.parse(item))
    //     // console.log('content', content); // TODO get mirrors and get similar files
    //     const nextMirror = () => {
    //         const mirror = mirrors.shift();
    //         if (mirror) {
    //             console.log('ACTIVE mirror', mirror);
    //             parserClass.getPage(mirror).then((mirrorPage) => {
    //                 const mirrorFilesLinks = collectLinksFromPage(mirrorPage);
    //
    //                 let replaceFilesCount = 0;
    //                 const REMOVE = [];
    //                 const next = () => {
    //                     const fileUrl = mirrorFilesLinks.shift();
    //                     if (fileUrl) {
    //                         parserClass.getPage(fileUrl).then((page) => {
    //                             const description = page.html.querySelector('#file_description');
    //                             if (description) {
    //                                 const [text] = description.childNodes;
    //                                 let fileDescription = text ? desanitize(text.rawText.trim()) : null;
    //                                 if (fileDescription) {
    //                                     fileDescription = fileDescription.replace(/\r\n/g, '');
    //                                     let replaceTo = content.find(({description}) => {
    //                                         return fileDescription === description;
    //                                     });
    //                                     try {
    //                                         const jsonDescription = JSON.parse(fileDescription);
    //                                         replaceTo = content.find(({description}) => {
    //                                             return jsonDescription.description === description;
    //                                         });
    //                                     } catch (e) {
    //
    //                                     }
    //                                     if (replaceTo) {
    //                                         const {name} = description.rawAttributes;
    //                                         replaceFilesCount++;
    //                                         const newValues = {
    //                                             'file[description]': JSON.stringify(replaceTo)
    //                                         };
    //                                         const body = parserClass.getPreparedBody(page.html, newValues);
    //                                         const valuesIdentical = fileDescription === JSON.stringify(replaceTo);
    //                                         if (valuesIdentical) {
    //                                             console.log('VALUES IDENTICAL');
    //                                             next();
    //                                         } else {
    //                                             parserClass.updateFile(fileUrl.replace('/edit', ''), body).then((data) => {
    //                                                 console.log('REPLACE : ' + name);
    //                                                 console.log('OLD VALUE : ', fileDescription);
    //                                                 console.log('NEW VALUE : ', JSON.stringify(replaceTo));
    //                                                 next();
    //                                             }).catch(() => {
    //                                                 console.error('UPDATE file error: ', fileUrl);
    //                                             })
    //                                         }
    //                                     } else {
    //                                         REMOVE.push(fileUrl);
    //                                         next();
    //                                         // console.error('REMOVE: ' + fileUrl);
    //                                     }
    //                                 }
    //                             } else {
    //                                 next();
    //                             }
    //                         }).catch((error) => {
    //                             console.error('ERROR LOAD FILE', error);
    //                             next();
    //                         });
    //                     } else {
    //                         console.log('REPLACED COUNT', replaceFilesCount);
    //                         console.log('ORIGINAL EN IMAGES COUNT', content.length)
    //                         console.log('REMOVE', REMOVE);
    //                         nextMirror();
    //                     }
    //                 }
    //                 next();
    //
    //             }).catch(() => {
    //                 console.error('ERROR GET mirror');
    //                 nextMirror();
    //             });
    //         } else {
    //             console.log('END');
    //
    //         }
    //     };
    //     nextMirror();
    // })

}).catch((error) => {
    console.error('ERROR LOAD PAGE', error);
});


