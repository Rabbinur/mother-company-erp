import mongoose, { Schema, Document, Model } from "mongoose";

export interface ICounter extends Document {
  key: string;
  seq: number;
  updatedAt: Date;
}

const CounterSchema = new Schema<ICounter>(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    seq: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true }
);

export interface CounterModel extends Model<ICounter> {
  getNextSequence(key: string, session?: mongoose.ClientSession): Promise<number>;
}

CounterSchema.statics.getNextSequence = async function (
  key: string,
  session?: mongoose.ClientSession
): Promise<number> {
  const result = await this.findOneAndUpdate(
    { key },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, session }
  );
  return result.seq;
};

export const Counter: CounterModel =
  (mongoose.models.Counter as CounterModel) ||
  mongoose.model<ICounter, CounterModel>("Counter", CounterSchema);
