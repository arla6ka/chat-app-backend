import mongoose, { Schema, Document } from 'mongoose';

const { ObjectId } = mongoose.Types;

export interface IMessage {
  sender: mongoose.Types.ObjectId;
  text: string;
  createdAt: Date;
}

export interface IConversation extends Document {
  participants: mongoose.Types.ObjectId[];
  messages: IMessage[];
}

const MessageSchema: Schema = new Schema({
  sender: { type: ObjectId, ref: 'User', required: true },
  text: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

const ConversationSchema: Schema = new Schema({
  participants: [{ type: ObjectId, ref: 'User' }],
  messages: [MessageSchema],
});

export default mongoose.model<IConversation>('Conversation', ConversationSchema);
