const parser = require('./../parser');


const parserClass = new parser(requestSettings);
// const allowedLangs = ['en', 'en-CA', 'en-NZ', 'en-AU', 'en-ZA', 'en-IE'];
const allowedLangs = ['en'];

const pageUrl = '/backend/cms/sites/4/files?category%5B%5D=slider-index-top';

const SEARCH_IMAGE = '1710х500 Min';
const collectLinksFromPage = (page) => {
    const links = [];
    const [files] = page.html.querySelectorAll('.cms-uploader-filelist');
    if (files) {
        const filesLinkRows = files.querySelectorAll('tr');
        filesLinkRows.forEach((row) => {
            if (row.toString().indexOf(SEARCH_IMAGE) !== -1) {
                const rowColumns = row.querySelectorAll('td');
                const buttonsContainer = rowColumns[rowColumns.length - 1];
                if (buttonsContainer) {
                    const editLink = buttonsContainer.querySelector('.btn.btn-default').rawAttributes.href;
                    links.push(editLink);
                }
            }
        });
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

    const nextMirror = () => {
        const mirror = mirrors.shift();
        if (mirror) {
            console.log('ACTIVE mirror', mirror);
            parserClass.getPage(mirror).then((mirrorPage) => {
                const [fileUrl] = collectLinksFromPage(mirrorPage);

                console.log('File url: ', fileUrl);

                if (fileUrl) {
                    parserClass.getPage(fileUrl).then((page) => {
                        const labels = page.html.querySelectorAll('label');
                        const sliderLabel = labels.find((label) => {
                            return label.toString().indexOf('slider-index-top') !== -1;
                        });
                        if (sliderLabel) {
                            const inputSliderIndexTop = sliderLabel.querySelector('input');
                            if (inputSliderIndexTop) {
                                const newValues = {
                                    [inputSliderIndexTop.rawAttributes.name]: 0
                                };
                                const body = parserClass.getPreparedBody(page.html, newValues);
                                parserClass.updateFile(fileUrl.replace('/edit', ''), body).then((data) => { // TODO uncomment
                                    console.log('Deactivated done');
                                    nextMirror();
                                }).catch(() => {
                                    console.error('UPDATE file error: ', fileUrl);
                                    nextMirror();
                                });
                            } else {
                                console.error('No banner checkbox');
                                nextMirror();
                            }
                        } else {
                            console.error('No banner checkbox label');
                            nextMirror();
                        }
                    }).catch((error) => {
                        console.error('ERROR LOAD FILE', error);
                        nextMirror();
                    });
                } else {
                    console.log('File not found');
                    nextMirror();
                }

            }).catch(() => {
                console.error('ERROR GET mirror');
                nextMirror();
            });
        } else {
            console.log('END');

        }
    };
    nextMirror();

}).catch((error) => {
    console.error('ERROR LOAD PAGE', error);
});


