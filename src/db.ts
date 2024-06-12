// server/src/db.ts
import mongoose from 'mongoose';

const connectDB = async () => {
  try {
    await mongoose.connect('mongodb+srv://arl:arl@cluster1.unitqkr.mongodb.net/?retryWrites=true&w=majority&appName=Cluster1');
    console.log('MongoDB connected');
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

export default connectDB;
