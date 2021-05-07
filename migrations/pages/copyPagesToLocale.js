const parser = require('./../parser');

const requestSettings = {
    domain: 'https://wildtornado.casino-backend.com',
    boundary: 'WebKitFormBoundaryFX2wOJjgGzdfLVZb',
    "cookie": "_ga=GA1.2.1865349641.1614590337; _ym_uid=1614590337283603234; _ym_d=1614590337; _gaexp=GAX1.2.jlMlDFeUQNSA4xPXx8EeHw.18774.1; trackers=IntcImdvb2dsZS1hbmFseXRpY3NcIjpcIjcwZDY2N2Q3LTUwOGYtNDE5YS05NDg3LTNlNzIyZmI0MTA5ZFwifSI%3D--631c2e74aa4f94ba8a5b8498b03fe8f76f5957e7; __cfduid=de3559bbb91480a4e34e1d939912be47f1617257186; _casino_session=353dbc7f95da844fc1f350c62b16be49; referral_params=eJxLTixJTc8vqlQ1dVI1dbEtzslMSS3SzcxLSa3QLckvAACu5Qse; locale=InJ1Ig%3D%3D--1b10702a9ebe972b8e9bf239d1177d913e1f1eb5; cf_use_ob=0; _gid=GA1.2.1773881780.1618397436; _ym_isad=2; _gat_UA-167804091-1=1"
};
const parserClass = new parser(requestSettings);
const allowedLangs = ['el'];

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

const generalPage = '/backend/cms/sites/4/pages';
parserClass.getPage(generalPage).then((page) => {
    const lis = page.html.querySelectorAll('[id^=comfy_cms_page]');
    const pagesUrls = lis.map((li) => {
        return li.rawAttributes.id.replace('comfy_cms_page_', '');
    }).filter((id) => {
      return !isNaN(+id);
    }).map((id) => {
        return generalPage + '/' + id + '/edit';
    });

    const nextPage = () => {
        const originalPage = pagesUrls.shift();
        if (originalPage) {

            parserClass.getPage(originalPage).then((page) => {
                const content = page.html.querySelector('#page_blocks_attributes_0_content');
                let valueContent = null;
                if (content) {
                    const [text] = content.childNodes;
                    valueContent = text ? desanitize(text.rawText.trim()) : null;
                }
                const title = page.html.querySelector('#page_blocks_attributes_1_content');
                let valueTitle = null;
                if (title) {
                    valueTitle = title.rawAttributes.value;
                }
                const keywords = page.html.querySelector('#page_blocks_attributes_2_content');
                let valueKeywords = null;
                if (keywords) {
                    valueKeywords = keywords.rawAttributes.value;
                }
                const description = page.html.querySelector('#page_blocks_attributes_3_content');
                let descriptionContent = null;
                if (description) {
                    const [text] = description.childNodes;
                    descriptionContent = text ? desanitize(text.rawText.trim()) : null;
                }

                const newValues = {};
                if (valueContent) {
                    newValues['page[blocks_attributes][0][content]'] = valueContent;
                }
                if (valueTitle) {
                    newValues['page[blocks_attributes][1][content]'] = valueTitle;
                }
                if (valueKeywords) {
                    newValues['page[blocks_attributes][2][content]'] = valueKeywords;
                }
                if (descriptionContent) {
                    newValues['page[blocks_attributes][3][content]'] = descriptionContent;
                }

                const prepareValues = {
                    'page[blocks_attributes][0][content]': desanitize
                };

                const pages = page.mirrors.filter((lang) => {
                    return allowedLangs.indexOf(Object.keys(lang)[0]) !== -1;
                }).map((lang) => {
                    return Object.values(lang)[0].replace('/edit', '');
                });

                console.log(originalPage, newValues);

                const next = () => {
                    const childPageUrl = pages.shift();
                    if (childPageUrl) {
                        parserClass.getPage(childPageUrl + '/edit').then((page) => {
                            const body = parserClass.getPreparedBody(page.html, newValues, prepareValues);
                            parserClass.updatePage(childPageUrl, body).then((data) => {
                                console.log('Update success', childPageUrl);
                                next();
                            })
                        }).catch((error) => {
                            console.error('ERROR EDIT PAGE', error);
                            next();
                        });
                    } else {
                        nextPage();
                    }
                };
                next();

            }).catch((error) => {
                console.error('ERROR LOAD PAGE', error);
                nextPage();
            });
        }
    };

    nextPage();

});


