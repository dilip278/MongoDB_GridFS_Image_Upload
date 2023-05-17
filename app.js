const express = require("express");
const crypto = require('crypto')

const bodyParser = require("body-parser");
const path = require('path');
const multer = require("multer");
const { GridFsStorage } = require('multer-gridfs-storage');
const Grid = require('gridfs-stream');
const methodOverride = require('method-override');
const mongoose = require("mongoose");

const app = express();

app.use(bodyParser.json());
app.use(methodOverride('_method'));

app.set('view engine', 'ejs');

//mongo URI localhost connection string, you can replace it with your machine mongo connection string
const MongoURI = 'mongodb://127.0.0.1:27017/fileupload';

//create mongo connection
const conn = mongoose.createConnection(MongoURI);


//init grifs stream
let gfs;
let gridfsBucket;
conn.once('open', () => {
    // initialize the buckket name
    gridfsBucket = new mongoose.mongo.GridFSBucket(conn.db, {
        bucketName: 'filedata'
    });

    gfs = Grid(conn.db, mongoose.mongo);
    gfs.collection('filedata')
})


//create storage engine
const storage = new GridFsStorage({
    url: MongoURI,
    file: (req, file) => {
        return new Promise((resolve, reject) => {
            crypto.randomBytes(16, (err, buf) => {
                if (err) {
                    return reject(err);
                }
                const filename = buf.toString('hex') + path.extname(file.originalname);
                const fileInfo = {
                    filename: filename,
                    bucketName: 'filedata'
                };
                resolve(fileInfo);
            });
        });
    }
});

const upload = multer({ storage });

//@route GET /
//@desc Loads form
app.get('/', async (req, res) => {

    let files = await gfs.files.find().toArray();

    //check if files exist
    if (!files || files.length === 0) {
        res.render('index', { files: false });

    } else {
        //iterate through all the files
        files.map(file => {
            //check the file type wheather its an image or not 
            if (file.contentType === 'image/jpeg' || file.contentType === 'image/png') {
                file.isImage = true;
            } else {
                file.isImage = false;
            }
        })
        res.render('index', { files: files });
    }

})

//@route to post /upload
//@desc upload files to db
app.post('/upload', upload.single('file'), (req, res) => {

    res.redirect('/')
})

//@route GET /files
//@desc Display all files in jSON
app.get('/files', async (req, res) => {
    let files = await gfs.files.find().toArray();

    //check if files exist
    if (!files || files.length === 0) {
        return res.status(404).json({ 'err': 'no files exist' })
    }

    //files exist
    return res.json(files)

})


//@route GET /files/:filename
//@desc Display files in jSON
app.get('/files/:filename', async (req, res) => {
    let files = await gfs.files.findOne({ filename: req.params.filename });

    //check if files exist
    if (!files || files.length === 0) {
        return res.status(404).json({ 'err': 'no files exist' })
    }

    //files exist
    return res.json(files)

})


//@route GET /image/:filename
//@desc Display single Image
app.get('/image/:filename', async (req, res) => {
    let files = await gfs.files.findOne({ filename: req.params.filename });

    //check if files exist
    if (!files || files.length === 0) {
        return res.status(404).json({ 'err': 'no files exist' })
    }

    const readStream = gridfsBucket.openDownloadStream(files._id);
    readStream.pipe(res);

})


//@rote DELETE /files/:id
//@desc delete file
app.delete('/files/:_id', (req, res) => {
    //convert the image id to mongodb object id
    const obj_id = new mongoose.Types.ObjectId(req.params._id);
    //pass the object id to gridfs delete function to delete file
    gridfsBucket.delete(obj_id);
    res.redirect('/');
})

//Code to start server
app.listen(3000, function () {
    console.log("Server Started at PORT 3000");
})