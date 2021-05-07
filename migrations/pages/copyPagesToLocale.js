const parser = require('./../parser');


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


