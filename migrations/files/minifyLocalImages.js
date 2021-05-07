const fs = require('fs');
const path = require("path");
const tinify = require("tinify");
tinify.key = "cdAAYvANwwLsWnzziLZuJOycGXvrD2UJ";

async function getFiles(path) {
    const entries = fs.readdirSync(path, { withFileTypes: true });

    // Get files within the current directory and add a path key to the file objects
    const files = entries
        .filter(file => !file.isDirectory())
        .map(file => ({ ...file, path: path + '/' + file.name }));

    // Get folders within the current directory
    const folders = entries.filter(folder => folder.isDirectory());

    for (const folder of folders)
        /*
          Add the found files within the subdirectory to the files array by calling the
          current function itself
        */
        files.push(...await getFiles(`${path}/${folder.name}`));

    return files;
}

(async function () {
    const appFiles = await getFiles(path.resolve(__dirname, '../../app/resources/images'));
    const coreFiles = await getFiles(path.resolve(__dirname, '../../core/app/resources/images'));
    const cacheJsonFilePath = "./cached/optimizedLocalFiles.json"
    const optimizedFiles = fs.existsSync(cacheJsonFilePath) && require(cacheJsonFilePath) || [];
    const cacheOptimizedImages = () => {
        fs.writeFile(cacheJsonFilePath, JSON.stringify(optimizedFiles), (err) => {
            if(err) {
                console.log(JSON.stringify(optimizedFiles));
                return console.log(err);
            }
            console.log("The file was updated!");
        });
    };


    const filteredFiles = [...appFiles, ...coreFiles].filter((item) => {
        const allowedExtensions = ['.png', '.jpg', '.jpeg'];
        return allowedExtensions.some((ext) => {
            return String(item.name).toLowerCase().indexOf(ext) !== -1;
        }) && optimizedFiles.indexOf(item.path) === -1;
    });

    const nextImage = () => {
        const image = filteredFiles.shift();
        if (image) {
            const source = tinify.fromFile(image.path);
            source.toFile(image.path).then(() => {
                optimizedFiles.push(image.path);
                console.log('Optimized', image.path);
                nextImage();
            }).catch((error) => {
                console.error('Optimized error', image.path, error);
                nextImage();
            })
        } else {
            cacheOptimizedImages();
        }
    }

    nextImage();

})();


