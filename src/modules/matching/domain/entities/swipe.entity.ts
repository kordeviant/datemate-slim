export interface SwipeEntity {
  id: number;
  userPairKey: string;
  fromUserId: number;
  toUserId: number;
  direction: 'RIGHT' | 'LEFT';
  createdAt: Date;
}
