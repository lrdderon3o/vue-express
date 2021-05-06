var HorsemanUploadImage = require('node-horseman');

module.exports = function(page, cookies, path, cb){
    const horseman = new HorsemanUploadImage();

    horseman.cookies(cookies)
        .userAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.84 Safari/537.36')
        .open(page)
        // .type('input[id="file_label"]', 'test minified')
        .upload('input[id="file_file"]', path)
        .click('input[type="submit"]')
        .waitForNextPage()
        .then(function() {
            cb();
            return horseman.close();
        }).catch(function (error) {
            cb(error);
            return horseman.close();
        });
}