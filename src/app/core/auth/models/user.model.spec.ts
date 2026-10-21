import { User } from './user.model';

describe('User model', () => {
  it('should create an instance', () => {
    expect(new User()).toBeTruthy();
  });
});
