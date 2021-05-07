const parser = require('./../parser');
const { parse } = require('node-html-parser');

const requestSettings = {
    domain: 'https://wildtornado.casino-backend.com',
    boundary: 'WebKitFormBoundaryFX2wOJjgGzdfLVZb',
    "cookie": "_ga=GA1.2.1865349641.1614590337; _ym_uid=1614590337283603234; _ym_d=1614590337; _gaexp=GAX1.2.jlMlDFeUQNSA4xPXx8EeHw.18774.1; trackers=IntcImdvb2dsZS1hbmFseXRpY3NcIjpcIjcwZDY2N2Q3LTUwOGYtNDE5YS05NDg3LTNlNzIyZmI0MTA5ZFwifSI%3D--631c2e74aa4f94ba8a5b8498b03fe8f76f5957e7; __cfduid=de3559bbb91480a4e34e1d939912be47f1617257186; _casino_session=353dbc7f95da844fc1f350c62b16be49; referral_params=eJxLTixJTc8vqlQ1dVI1dbEtzslMSS3SzcxLSa3QLckvAACu5Qse; locale=InJ1Ig%3D%3D--1b10702a9ebe972b8e9bf239d1177d913e1f1eb5; _gid=GA1.2.1676494279.1617600159; cf_use_ob=0; _ym_isad=2"
};
const parserClass = new parser(requestSettings);
// const allowedLangs = ['en', 'en-CA', 'en-NZ', 'en-AU', 'en-ZA', 'en-IE'];
const allowedLangs = ['en'];

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

const tournament = 'playson-cash-parade'

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
                const newTournament = parse(`<li class="tournaments-list__item">
        <div class="tournaments-list__item--container">
            <img class="tournaments-list__bg" src="/system/comfy/cms/files/files/000/002/139/original/414%D1%85530_playson_cash_paradise.png" alt="">
                <div class="tournaments-list__text"></div>
                <a ui-sref="app.external({id:'tournaments/playson-cash-parade'})" class="tournaments-list__link">MORE INFO</a>
        </div>
    </li>`)

                let tournamentExist = false;
                const lis = newHTML.querySelectorAll('li');
                lis.forEach((li) => {
                    const wildHuntersLi = li.toString().indexOf(`tournaments/${tournament}`) !== -1;
                    if (wildHuntersLi) {
                        tournamentExist = true;
                        // li.parent.insertBefore(newTournament, li.nextSibling)
                        // // li.remove();
                    }
                });

                if (!tournamentExist && lis[0]) {
                    lis[0].parentNode.appendChild(newTournament);
                }

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



