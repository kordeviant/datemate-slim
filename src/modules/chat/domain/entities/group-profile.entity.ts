export interface GroupProfileProps {
  conversationId: string;
  ownerId: number;
  active: boolean;
  isPrivate: boolean;
  title: string;
  bio?: string | null;
  gender?: string | null;
  minimumAge?: number | null;
  maximumAge?: number | null;
  subjectId?: number | null;
  cityId?: number | null;
  avatar?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Metadata owned by Chat Service; user/city/interest display data is owned by Main Backend. */
export class GroupProfile {
  constructor(private readonly props: GroupProfileProps) {
    if (!props.title || props.title.trim().length < 2 || props.title.trim().length > 100) {
      throw new Error("Group title must be between 2 and 100 characters");
    }
    if (props.bio && props.bio.length > 500) throw new Error("Group bio cannot exceed 500 characters");
    if (
      props.minimumAge !== null && props.minimumAge !== undefined &&
      props.maximumAge !== null && props.maximumAge !== undefined &&
      props.minimumAge > props.maximumAge
    ) {
      throw new Error("minimumAge cannot be greater than maximumAge");
    }
  }

  get conversationId() { return this.props.conversationId; }
  get ownerId() { return this.props.ownerId; }
  get active() { return this.props.active; }
  get isPrivate() { return this.props.isPrivate; }
  get title() { return this.props.title; }
  get bio() { return this.props.bio; }
  get gender() { return this.props.gender; }
  get minimumAge() { return this.props.minimumAge; }
  get maximumAge() { return this.props.maximumAge; }
  get subjectId() { return this.props.subjectId; }
  get cityId() { return this.props.cityId; }
  get avatar() { return this.props.avatar; }
  get createdAt() { return this.props.createdAt; }
  get updatedAt() { return this.props.updatedAt; }

  public toJSON(): GroupProfileProps { return { ...this.props }; }
}
