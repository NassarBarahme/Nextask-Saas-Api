import { Role } from 'src/generated/prisma/enums';

export interface TokenPayload {
  sub: string;
  email: string;
  role: Role;
  orgId: string;
}
