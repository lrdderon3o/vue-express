const parser = require('./../parser');
const { parse } = require('node-html-parser');


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



