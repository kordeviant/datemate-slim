export interface DirectPairProps {
  canonicalPairKey: string;
  conversationId: string;
  createdAt: Date;
}

export class DirectPair {
  constructor(private readonly props: DirectPairProps) {}

  get canonicalPairKey(): string {
    return this.props.canonicalPairKey;
  }

  get conversationId(): string {
    return this.props.conversationId;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  public toJSON() {
    return { ...this.props };
  }
}
