const { v4: uuidV4 } = require('uuid')
const AWS = require("aws-sdk");
const awsConfig = require("./config-s3");

AWS.config.update({ region: awsConfig.region });

const S3_BUCKET = awsConfig.bucketName;
const s3 = new AWS.S3({
  accessKeyId: awsConfig.accessKeyId,
  secretAccessKey: awsConfig.secretAccessKey,
  region: awsConfig.region
//   signatureVersion: "v4",
  //   useAccelerateEndpoint: true
});

const getPresignedUrl = (req, res) => {
 let fileType = req.body.fileType;

  fileType = fileType.substring(1, fileType.length);

  const fileName = uuidV4();
  const s3Params = {
    Bucket: S3_BUCKET,
    Key: "mobile_uploads/" + fileName + "." + fileType,
    // Expires: 60 * 60,
    ContentType: "application/" + fileType,
    ACL: "public-read",
  };

  s3.getSignedUrl("putObject", s3Params, (err, data) => {
    if (err) {
      console.log(err);
      return res.end();
    }
    const returnData = {
      success: true,
      message: "Url generated",
      uploadUrl: data,
      downloadUrl:
        `https://${S3_BUCKET}.s3.amazonaws.com/mobile_uploads/${fileName}` + "." + fileType,
    };
    return res.status(201).json(returnData);
  });
};

module.exports = { getPresignedUrl }
