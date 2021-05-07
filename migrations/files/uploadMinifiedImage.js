const parser = require('./../parser');
const horsemanUploadImage = require('../horsemanUploadImage');
const fs = require("fs");
const path = require("path");
const tinify = require("tinify");
tinify.key = "cdAAYvANwwLsWnzziLZuJOycGXvrD2UJ";

const cookie = "_ga=GA1.2.1865349641.1614590337; _ym_uid=1614590337283603234; _ym_d=1614590337; _gaexp=GAX1.2.jlMlDFeUQNSA4xPXx8EeHw.18774.1; trackers=IntcImdvb2dsZS1hbmFseXRpY3NcIjpcIjcwZDY2N2Q3LTUwOGYtNDE5YS05NDg3LTNlNzIyZmI0MTA5ZFwifSI%3D--631c2e74aa4f94ba8a5b8498b03fe8f76f5957e7; __cfduid=de3559bbb91480a4e34e1d939912be47f1617257186; _casino_session=353dbc7f95da844fc1f350c62b16be49; referral_params=eJxLTixJTc8vqlQ1dVI1dbEtzslMSS3SzcxLSa3QLckvAACu5Qse; locale=InJ1Ig%3D%3D--1b10702a9ebe972b8e9bf239d1177d913e1f1eb5; cf_use_ob=0; _gid=GA1.2.1773881780.1618397436; _ym_isad=2";

const filesPath = './files-temp';
const cookieArr = cookie.split(';').map((item) => {
    const [name, value] = item.split('=');
    return {
        name,
        value,
        domain
    }
});

const searchImagesRegexp = /(srcSet|src|url|lazy-img|slide-src)[=\(]?("|')?(\/system\/.*?("|\)|'))/gm;
const getOnlyUrlRegexp = /\/system\/.*(png|jpg|jpeg)/gmi;
const optimizedMarker = '_optimized_by_tinify';
// const allowedLanguages = ['en'];
const allowedLanguages = [];

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

const requestSettings = {
    domain: `https://${domain}`,
    boundary: 'WebKitFormBoundarySuMN98yBW4WVoR41',
    "cookie": cookie
};
const parserClass = new parser(requestSettings);

const tinifyImage = (imageUrl, callback) => {
    const originalImageNameArr = imageUrl.split('/original/');
    const imageName = originalImageNameArr[originalImageNameArr.length - 1];
    const imageNameArr = imageName.split('.');
    imageNameArr[imageNameArr.length - 1] = `${optimizedMarker}.` + imageNameArr[imageNameArr.length - 1];
    const optimizedImageName = imageNameArr.join('');

    // console.log(imageName, optimizedImageName, imageUrl);

    const optimizedImagePath = path.resolve(filesPath + '/' + optimizedImageName);
    const fileExist = fs.existsSync(optimizedImagePath);
    if (fileExist) {
        callback(optimizedImagePath);
    } else {
        const source = tinify.fromUrl('https://' + domain + imageUrl);
        source.toFile(optimizedImagePath).then((response) => {
            // console.log(response);
            callback(optimizedImagePath);
        }).catch((error) => {
            // console.error(imageUrl, error);
            callback();
        })
    }
}

const updateImageOnPagesAndSnippets = (pages, imageUrl, newImageUrl, callback) => {

   const nextPage = () => {
       const pageUrl = pages.shift();
       if (pageUrl) {

           parserClass.getPage(pageUrl + '/edit').then((page) => {
               const preparedKey = pageUrl.indexOf('/snippets/') !== -1 ? 'snippet[content]' : 'page[blocks_attributes][0][content]';
               const preparedValues = {
                   'page[label]': desanitize,
                   [preparedKey]: desanitize
               }

               const preparedBodyJSON = parserClass.getPreparedBody(page.html, {}, preparedValues, true);
               const newValue = String(preparedBodyJSON[preparedKey] || '').replace(new RegExp(imageUrl, 'gm'), newImageUrl);
               const newValues = {
                   [preparedKey]: newValue
               };
               const newBody = parserClass.getPreparedBody(page.html, newValues, preparedValues);

               parserClass.updatePage(pageUrl, newBody).then(() => {
                   console.log('Image changed on : ', pageUrl);
                   nextPage();
               }).catch(() => {
                   console.error('Can`t update page', pageUrl);
                   nextPage();
               })

           }).catch(() => {
                console.error('Can`t get page', pageUrl);
                nextPage();
           });
       } else {
           callback();
       }
   }

    nextPage();

}

const changeImages = (updateImages) => {
    console.log('Update Images', updateImages);

    let imagesUrls = Object.keys(updateImages);

    const lastSuccessImageIndex = imagesUrls.indexOf('/system/comfy/cms/files/files/000/002/197/original/414x530_yggdrasil_diving_for_dough.png')

    const editOnly = []

    imagesUrls = imagesUrls.filter((k, index) => {
        return index > lastSuccessImageIndex || editOnly.indexOf(k) !== -1;
    });

    console.log(imagesUrls);

    const nextImage = () => {
        const imageUrl = imagesUrls.shift();
        if (imageUrl) {
            const imageObj = updateImages[imageUrl];
            if (imageObj) {
                console.log('Update image : ', imageObj.editUrl);
                uploadNewImage(imageObj.editUrl, imageObj.uploadFileUrl, (updated) => {
                    if (updated) {
                        console.log('Image uploaded : ', imageObj.editUrl);
                        parserClass.getPage(imageObj.editUrl).then((filePage) => {
                            const imageContainer = filePage.html.querySelector('.file-image');
                            if (imageContainer) {
                                const image = imageContainer.querySelector('img');
                                const newImageUrl = image && image.rawAttributes.src;
                                updateImageOnPagesAndSnippets(imageObj.pages, imageUrl, newImageUrl, () => {
                                    nextImage();
                                });
                            } else {
                                console.error('No image container');
                                nextImage();
                            }
                        }).catch(() => {
                            console.error('Can`t get file page', imageObj.editUrl);
                            nextImage();
                        })
                    } else {
                        console.error('Image not updated', imageObj.editUrl)
                        nextImage();
                    }
                });
            } else {
                console.error('imageObj is undefined', imageObj, imageUrl)
                nextImage();
            }
        } else {
            console.log('FINISHED !!!!!!!');
        }
    }

    nextImage();

}

const uploadNewImage = (editUrl, uploadFileUrl, callback) => {
    horsemanUploadImage('https://' + domain + editUrl, cookieArr, uploadFileUrl, (error) => {
        if (error) {
            console.error(error);
        }
        callback(!error);
    });
}

const getUniqArr = (item, index, originalArr) => {
    return originalArr.indexOf(item) === index;
};

const getOnlyUrl = (url) => {
    const match = (url || '').match(getOnlyUrlRegexp);
    return match && match[0];
};

const collectMirrorsFromPage = (pageUrl, callback) => {
    parserClass.getPage(pageUrl).then((originalPage) => {
        const snippetMirrors = originalPage.mirrors
            .filter((lang) => {
                return allowedLanguages.length ? allowedLanguages.indexOf(Object.keys(lang)[0]) !== -1 : true;
            })
            .map((lang) => {
                return Object.values(lang)[0].replace('/edit', '');
            });
        callback((snippetMirrors || []));
    }).catch(() => {
        console.error('Get error original page : ', pageUrl);
        callback([]);
    });
};

const getSnippetsUls = (callback) => {
    const generalPage = '/backend/cms/sites/4/snippets'
    parserClass.getPage(generalPage).then((snippetsPage) => {
        const lis = snippetsPage.html.querySelectorAll('[id^=comfy_cms_snippet]');
        const pagesUrls = lis.map((li) => {
            return li.rawAttributes.id.replace('comfy_cms_snippet_', '');
        }).filter((id) => {
            return !isNaN(+id);
        }).map((id) => {
            return generalPage + '/' + id + '/edit';
        });

        let allSnippetUrls = [];

        const nextPage = () => {
            const originalPage = pagesUrls.shift();
            console.log('Active snippet : ', originalPage);
            if (originalPage) {
                collectMirrorsFromPage(originalPage, (mirrors) => {
                    allSnippetUrls = [...allSnippetUrls, ...(mirrors || [])];
                    nextPage();
                });
            } else {
                callback(allSnippetUrls);
            }
        }
        nextPage();

    });
};

const collectImagesUrlsFromSnippets = (callback) => {
    const savedUrls = require('./cached/snippetsFiles.json');
    if (savedUrls && Object.keys(savedUrls).length) {
        callback(savedUrls);
        return;
    }
    let collectedUrls = {};
    const prepareValues = {
        'snippet[content]': desanitize
    };
    getSnippetsUls((allSnippets) => {

        const getSnippet = () => {
            const snippetUrl = allSnippets.shift();
            if (snippetUrl) {
                console.log('Collect images from snippet : ', snippetUrl);
                parserClass.getPage(snippetUrl + '/edit').then((snippetPage) => {
                    const {'snippet[content]': content = ''} = parserClass.getPreparedBody(snippetPage.html, {}, prepareValues, true);
                    const images = content.match(searchImagesRegexp) || [];
                    if (images.length) {
                        collectedUrls[snippetUrl] = images;
                    }
                    getSnippet();
                }).catch(() => {
                    console.error('Get error snippet : ', snippetUrl);
                    getSnippet();
                });
            } else {
                callback(collectedUrls);
            }
        }

        getSnippet();

    });
}

const getPagesUls = (callback) => {
    const generalPage = '/backend/cms/sites/4/pages'
    parserClass.getPage(generalPage).then((page) => {
        const lis = page.html.querySelectorAll('[id^=comfy_cms_page]');
        const pagesUrls = lis.map((li) => {
            return li.rawAttributes.id.replace('comfy_cms_page_', '');
        }).filter((id) => {
            return !isNaN(+id);
        }).map((id) => {
            return generalPage + '/' + id + '/edit';
        });

        let allPagesUrls = [];

        const nextPage = () => {
            const originalPage = pagesUrls.shift();
            console.log('Active page : ', originalPage);
            if (originalPage) {
                collectMirrorsFromPage(originalPage, (mirrors) => {
                    allPagesUrls = [...allPagesUrls, ...(mirrors || [])];
                    nextPage();
                });
            } else {
                callback(allPagesUrls);
            }
        }
        nextPage();

    });
};

const collectImagesUrlsFromPages = (callback) => {
    const savedUrls = require('./cached/pagesFiles.json');
    if (savedUrls && Object.keys(savedUrls).length) {
        callback(savedUrls);
        return;
    }
    let collectedUrls = {};
    const prepareValues = {
        'page[blocks_attributes][0][content]': desanitize
    };
    getPagesUls((allPages) => {

        const getPage = () => {
            const snippetUrl = allPages.shift();
            if (snippetUrl) {
                console.log('Collect images from page : ', snippetUrl);
                parserClass.getPage(snippetUrl + '/edit').then((snippetPage) => {
                    const {'page[blocks_attributes][0][content]': content = ''} = parserClass.getPreparedBody(snippetPage.html, {}, prepareValues, true);
                    const images = content.match(searchImagesRegexp) || [];
                    if (images.length) {
                        collectedUrls[snippetUrl] = images;
                    }
                    getPage();
                }).catch(() => {
                    console.error('Get error snippet : ', snippetUrl);
                    getPage();
                });
            } else {
                callback(collectedUrls);
            }
        }

        getPage();

    });
}

const getAllFilesFromLocale = (localeUrl, callback) => {

    const collectedUrls = {};

    const addImagesFromPage = (page) => {
        const lis = page.html.querySelectorAll('[id^=comfy_cms_file]');
        const pagesIds= lis.map((li) => {
            return li.rawAttributes.id.replace('comfy_cms_file_', '');
        }).filter((id) => {
            return !isNaN(+id);
        });

        pagesIds.forEach((filePageId) => {
           const editFileUrl = localeUrl + '/' + filePageId + '/edit';
           const fileEditElem = page.html.querySelector(`[id=comfy_cms_file_${filePageId}]`);
           if (fileEditElem) {
               const fileUrlElem = fileEditElem.querySelector('input[class="file-path"]');
               const fileUrl = fileUrlElem && fileUrlElem.rawAttributes.value;
               const fileCategories = fileEditElem.querySelectorAll('div[class="category"]').map((item) => {
                   return item.innerHTML;
               });
               const fileSizeElem = fileEditElem.querySelector('div[class="file-size"]');
               collectedUrls[fileUrl] = {
                   editUrl: editFileUrl,
                   categories: fileCategories,
                   fileSize: (fileSizeElem && fileSizeElem.innerHTML || '0 KB').replace(/\n/g, '')
               };
           }
        });
    };

    parserClass.getPage(localeUrl).then((firstFilesPage) => {
        const paginationLinks = firstFilesPage.html.querySelectorAll(`a[href^="${localeUrl}?page="]`);
        const paginationPages = paginationLinks.map((item) => {
            return String(item.rawAttributes.href || '').split('page=')[1];
        }).filter((item) => {
            return !!item;
        }).map((item) => {
            return +item;
        });
        const maxPage = Math.max.apply(null, paginationPages);
        let currentPage = 1;

        addImagesFromPage(firstFilesPage);

        const nextPage = () => {
            currentPage++;
            if (currentPage <= maxPage) {
                const nestedPageUrl = localeUrl + '?page=' + currentPage;
                parserClass.getPage(nestedPageUrl).then((filesPage) => {
                    addImagesFromPage(filesPage);
                    nextPage();
                }).catch(() => {
                    console.error('Get nested files page error', nestedPageUrl);
                    nextPage();
                })
            } else {
                callback(collectedUrls);
            }
        }
        nextPage();

    }).catch(() => {
        callback(collectedUrls);
        console.error('Get locale files page error', localeUrl);
    });
}

const getAllCmsFiles = (callback) => {
    const filesObjs = require('./cached/allCmsFiles.json');
    if (filesObjs && Object.keys(filesObjs).length) {
        callback(filesObjs);
        return;
    }

    collectMirrorsFromPage('/backend/cms/sites/4/files', (filesPages) => {

        console.log('filesPages', filesPages);

        let allImagesObjs = {};

        const getLocaleFiles = () => {
            const localeUrl = filesPages.shift();
            if (localeUrl) {
                getAllFilesFromLocale(localeUrl, (filesObj) => {
                    allImagesObjs = {...allImagesObjs, ...filesObj};
                    getLocaleFiles();
                });
            } else {
                callback(allImagesObjs);
                console.log('END collect files urls from locales', Object.keys(allImagesObjs).length);
            }

        }
        getLocaleFiles();
    });
};

const getPreparedUrlsInPagesObj = (images) => {
    return Object.keys(images).reduce((result, url) => {
        const preparedUrls = images[url]
            .map(getOnlyUrl)
            .filter((item) => !!item)
            .filter(getUniqArr);
        if (preparedUrls && preparedUrls.length) {
            result[url] = preparedUrls;
        }
        return result;
    }, {});
}

collectImagesUrlsFromSnippets((imagesUrlsOnSnippets) => {
    console.log('All images snippets ulrs length', imagesUrlsOnSnippets.length);

    imagesUrlsOnSnippets = getPreparedUrlsInPagesObj(imagesUrlsOnSnippets);

    // console.log('filterCollectedSnippetsUrls', filterCollectedSnippetsUrls.length);

    collectImagesUrlsFromPages((imagesUrlsOnPages) => {
        console.log('All images pages ulrs length', imagesUrlsOnPages.length);

        imagesUrlsOnPages = getPreparedUrlsInPagesObj(imagesUrlsOnPages);

        const allImagesUrls = [
            ...Object.keys(imagesUrlsOnSnippets).reduce((result, key) => {
                return [...result, ...imagesUrlsOnSnippets[key]];
            }, []),
            ...Object.keys(imagesUrlsOnPages).reduce((result, key) => {
                return [...result, ...imagesUrlsOnPages[key]];
            }, [])
        ]
            .filter(getUniqArr)
            .filter((item) => {
                return item.indexOf(optimizedMarker) === -1;
            });

        console.log('allImagesUrls', allImagesUrls.length, allImagesUrls);

        const nonExistentImages = [];
        const preparedImages = {};

        const nextImage = () => {
            const imageUrl = allImagesUrls.shift();
            if (imageUrl) {
                tinifyImage(imageUrl, (localImageUrl) => {
                    if (localImageUrl) {
                        preparedImages[imageUrl] = localImageUrl;
                    } else {
                        nonExistentImages.push(imageUrl);
                    }
                    nextImage();
                });
            } else {
                console.log('END prepare images', preparedImages.length + nonExistentImages.length);
                getAllCmsFiles((allCMSFiles) => {

                    const needUpdateCMSfiles = Object.keys(preparedImages).reduce((result, fileUrl) => {
                        result[fileUrl] = allCMSFiles[fileUrl];
                        if (result[fileUrl]) {
                            result[fileUrl].uploadFileUrl = preparedImages[fileUrl];
                            result[fileUrl].pages = [
                                ...Object.keys(imagesUrlsOnSnippets).filter((key) => {
                                    return imagesUrlsOnSnippets[key].indexOf(fileUrl) !== -1;
                                }),
                                ...Object.keys(imagesUrlsOnPages).filter((key) => {
                                    return imagesUrlsOnPages[key].indexOf(fileUrl) !== -1;
                                })
                            ];
                        }
                        return result;
                    }, {});
                    const nonExistentFiles = nonExistentImages.reduce((result, fileUrl) => {
                        result[fileUrl] = allCMSFiles[fileUrl];
                        return result;
                    }, {});

                    changeImages(needUpdateCMSfiles);

                    // console.log('needUpdateCMSfiles', Object.keys(needUpdateCMSfiles).length);
                    // console.log('nonExistentFiles', nonExistentFiles);
                    // console.log(preparedImages, nonExistentImages)
                });
            }
        };
        nextImage();

    });

});