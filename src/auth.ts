import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import User, { IUser } from './models/User';

const secret = 'your_secret_key'; 

export const generateToken = (user: IUser) => {
  return jwt.sign({ id: user._id, username: user.username }, secret, {
    expiresIn: '1d',
  });
};

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return res.status(401).send({ error: 'Unauthorized' });

  try {
    const decoded = jwt.verify(token, secret) as { id: string };
    const user = await User.findById(decoded.id);
    if (!user) throw new Error();
    req.user = user;
    next();
  } catch (err) {
    res.status(401).send({ error: 'Unauthorized' });
  }
};
