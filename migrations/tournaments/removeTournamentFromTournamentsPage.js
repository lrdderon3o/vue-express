const parser = require('./../parser');
const { parse } = require('node-html-parser');

const requestSettings = {
    domain: 'https://wildtornado.casino-backend.com',
    boundary: 'WebKitFormBoundaryFX2wOJjgGzdfLVZb',
    "cookie": "_ga=GA1.2.1865349641.1614590337; _ym_uid=1614590337283603234; _ym_d=1614590337; _gaexp=GAX1.2.jlMlDFeUQNSA4xPXx8EeHw.18774.1; referral_params=eJwrSi1OLYkvSCwuLs8vSokvyc9OzbO1LDS2rMo1TvX1NsqorPIINHfPzAAAU6YPVQ%3D%3D; trackers=IntcImdvb2dsZS1hbmFseXRpY3NcIjpcIjcwZDY2N2Q3LTUwOGYtNDE5YS05NDg3LTNlNzIyZmI0MTA5ZFwifSI%3D--631c2e74aa4f94ba8a5b8498b03fe8f76f5957e7; cf_use_ob=0; __cfduid=de3559bbb91480a4e34e1d939912be47f1617257186; _gid=GA1.2.1523401659.1617257187; _ym_isad=2; _casino_session=353dbc7f95da844fc1f350c62b16be49"
};
const parserClass = new parser(requestSettings);
// const allowedLangs = ['en', 'en-CA', 'en-NZ', 'en-AU', 'en-ZA', 'en-IE'];
// const allowedLangs = ['en'];

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
    // ret = ret.replace(/"/g, '\\"');
    return ret;
};

const tournament = 'cash-splash'

parserClass.getPage('/backend/cms/sites/4/pages/2221/edit').then((page) => {

    const pages = page.mirrors
        // .filter((lang) => {
        //     return allowedLangs.indexOf(Object.keys(lang)[0]) !== -1;
        // })
        .map((lang) => {
        return Object.values(lang)[0].replace('/edit', '');
    });

    // const prepareValues = {
    //     'page[blocks_attributes][0][content]': desanitize
    // };

    const next = () => {
        const childPageUrl = pages.shift();
        if (childPageUrl) {
            parserClass.getPage(childPageUrl + '/edit').then((page) => {
                const textArea = page.html.querySelector('textarea[name^=page]');
                const [text] = textArea.childNodes;
                const value = text ? desanitize(text.rawText.trim()) : null;
                const newHTML = parse(value);
                newHTML.querySelectorAll('li').forEach((li) => {
                    const wildHuntersLi = li.toString().indexOf(`tournaments/${tournament}`) !== -1;
                    if (wildHuntersLi) {
                        li.remove();
                    }
                });

                const newValues = {
                    'page[blocks_attributes][0][content]': newHTML.toString()
                };

                const body = parserClass.getPreparedBody(page.html, newValues);

                parserClass.updatePage(childPageUrl, body).then((data) => {
                    console.log('Update success', childPageUrl);
                    next();
                })
            }).catch((error) => {
                console.error('ERROR EDIT PAGE', error);
                next();
            });
        }
    };
    next();

}).catch((error) => {
    console.error('ERROR LOAD PAGE', error);
});



