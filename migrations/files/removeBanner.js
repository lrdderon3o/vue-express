const parser = require('./../parser');

const requestSettings = {
    domain: 'https://wildtornado.casino-backend.com',
    boundary: 'WebKitFormBoundarySuMN98yBW4WVoR41',
    "cookie": "_ga=GA1.2.1865349641.1614590337; _ym_uid=1614590337283603234; _ym_d=1614590337; _gaexp=GAX1.2.jlMlDFeUQNSA4xPXx8EeHw.18774.1; referral_params=eJwrSi1OLYkvSCwuLs8vSokvyc9OzbO1LDS2rMo1TvX1NsqorPIINHfPzAAAU6YPVQ%3D%3D; trackers=IntcImdvb2dsZS1hbmFseXRpY3NcIjpcIjcwZDY2N2Q3LTUwOGYtNDE5YS05NDg3LTNlNzIyZmI0MTA5ZFwifSI%3D--631c2e74aa4f94ba8a5b8498b03fe8f76f5957e7; cf_use_ob=0; __cfduid=de3559bbb91480a4e34e1d939912be47f1617257186; _gid=GA1.2.1523401659.1617257187; _ym_isad=2; _casino_session=353dbc7f95da844fc1f350c62b16be49"
};
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


