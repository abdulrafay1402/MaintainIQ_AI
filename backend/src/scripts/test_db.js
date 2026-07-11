const mongoose = require('mongoose');

const testNonSrv = async () => {
  try {
    console.log('Testing non-SRV MongoDB Connection...');
    const uri = 'mongodb://k243007_db_user:k243007@ac-otupkrb-shard-00-00.pzsh8hu.mongodb.net:27017/maintainiq?ssl=true&authSource=admin&retryWrites=true&w=majority';
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    console.log('Success: Direct MongoDB Connection worked!');
    await mongoose.disconnect();
  } catch (error) {
    console.log('Failed Direct Connection. Error:', error.message);
  }
  process.exit(0);
};

testNonSrv();
