const expect = require('expect');
const {Users} = require('./users');

describe('Users', () => {

    var users;
    beforeEach(() => {
        users = new Users();
        users.users = [{
            id: '1',
            name: 'Mike',
            room: 'NodeJS'
        },{
            id: '2',
            name: 'Tom',
            room: 'React'
        },{
            id: '3',
            name: 'Robert',
            room: 'NodeJS'
        }];
    });

    it('should add new user', () => {
        var users = new Users();
        var user = {
            id: '123',
            name: 'Arjun',
            room: 'The Office'
        };
        var resUser = users.addUser(user.id, user.name, user.room);
        expect(users.users).toEqual([user]);
    });

    it('should return names for node course', () => {
         var userList = users.getUserList('NodeJS');
         expect(userList).toEqual(['Mike', 'Robert']);
    });

    it('should return names for react course', () => {
         var userList = users.getUserList('React');
         expect(userList).toEqual(['Tom']);
    });

    it('should find user', () => {
        var userId = '2';
        var user = users.getUser(userId);
        expect(user.id).toBe(userId);
    });

    it('should find not user', () => {
        var userId = '4';
        var user = users.getUser(userId);
        expect(user).toNotExist();
    });    

    it('should remove a user', () => {
        var userId = '1';
        var user = users.removeUser(userId);
        expect(user.id).toBe(userId);
        expect(users.users.length).toBe(2);
    });

    it('should not remove a user', () => {
        var userId = '88';
        var user = users.removeUser(userId);
        expect(user).toNotExist();
        expect(users.users.length).toBe(3);
    });
});