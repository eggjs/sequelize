'use strict';

const  chai = require('chai'),
  expect = chai.expect,
  Support = require(__dirname + '/../support'),
  Sequelize = require('../../../index'),
  Promise = Sequelize.Promise;

describe(Support.getTestDialectTeaser('Alias on ContextModel'), () => {
  class Context {
    constructor(val) {
      this.value = val;
    }
  }

  it('should uppercase the first letter in alias getter, but not in eager loading', function() {
    const User = this.sequelize.define('user', {});
    const Task = this.sequelize.define('task', {});
    User.hasMany(Task, { as: 'assignments', foreignKey: 'userId' });
    Task.belongsTo(User, { as: 'owner', foreignKey: 'userId' });

    const ctx1 = new Context('ctx1');
    const ctx2 = new Context('ctx2');
    const ContextUser1 = User.contextify(ctx1);
    const ContextUser2 = User.contextify(ctx2);
    const ContextTask1 = Task.contextify(ctx1);
    const ContextTask2 = Task.contextify(ctx2);

    return this.sequelize.sync({ force: true }).then(() => {
      return Promise.all([
        ContextUser1.create({ id: 1 }),
        ContextUser2.create({ id: 2 })
      ]);
    }).spread((user1, user2) => {
      expect(user1.id).to.equal(1);
      expect(user1.ctx).to.be.ok;
      expect(user1.ctx.value).to.equal('ctx1');
      expect(user1.getAssignments).to.be.ok;

      expect(user2.id).to.equal(2);
      expect(user2.ctx).to.be.ok;
      expect(user2.ctx.value).to.equal('ctx2');
      expect(user2.getAssignments).to.be.ok;

      return Promise.all([
        ContextTask1.create({ id: 1, userId: 1 }),
        ContextTask2.create({ id: 2, userId: 2 })
      ]);
    }).spread((task1, task2) => {
      expect(task1.ctx).to.be.ok;
      expect(task1.ctx.value).to.equal('ctx1');
      expect(task1.getOwner).to.be.ok;

      expect(task2.ctx).to.be.ok;
      expect(task2.ctx.value).to.equal('ctx2');
      expect(task2.getOwner).to.be.ok;

      return Promise.all([
        ContextUser1.find({ where: { id: 1 }, include: [{model: Task, as: 'assignments'}] }),
        ContextTask1.find({ where: { id: 1 }, include: [{model: User, as: 'owner'}] }),
        ContextUser2.find({ where: { id: 2 }, include: [{model: Task, as: 'assignments'}] }),
        ContextTask2.find({ where: { id: 2 }, include: [{model: User, as: 'owner'}] })
      ]);
    }).spread((user1, task1, user2, task2) => {
      expect(user1.ctx.value).to.equal('ctx1');
      expect(user1.assignments).to.be.ok;
      expect(task1.ctx.value).to.equal('ctx1');
      expect(task1.owner).to.be.ok;

      expect(user2.ctx.value).to.equal('ctx2');
      expect(user2.assignments).to.be.ok;
      expect(task2.ctx.value).to.equal('ctx2');
      expect(task2.owner).to.be.ok;
    });
  });

  it('shouldnt touch the passed alias', function() {
    const  User = this.sequelize.define('user', {}),
      Task = this.sequelize.define('task', {});

    User.hasMany(Task, { as: 'ASSIGNMENTS', foreignKey: 'userId' });
    Task.belongsTo(User, { as: 'OWNER', foreignKey: 'userId' });

    const ctx1 = new Context('ctx1');
    const ContextUser1 = User.contextify(ctx1);
    const ContextTask1 = Task.contextify(ctx1);

    return this.sequelize.sync({ force: true }).then(() => {
      return ContextUser1.create({ id: 1 });
    }).then(user => {
      expect(user.ctx.value).to.equal('ctx1');
      expect(user.getASSIGNMENTS).to.be.ok;

      return ContextTask1.create({ id: 1, userId: 1 });
    }).then(task => {
      expect(task.ctx.value).to.equal('ctx1');
      expect(task.getOWNER).to.be.ok;

      return Promise.all([
        ContextUser1.find({ where: { id: 1 }, include: [{model: Task, as: 'ASSIGNMENTS'}] }),
        ContextTask1.find({ where: { id: 1 }, include: [{model: User, as: 'OWNER'}] })
      ]);
    }).spread((user, task) => {
      expect(user.ctx.value).to.equal('ctx1');
      expect(user.ASSIGNMENTS).to.be.ok;
      expect(task.ctx.value).to.equal('ctx1');
      expect(task.OWNER).to.be.ok;
    });
  });

  it('should allow me to pass my own plural and singular forms to hasMany', function() {
    const UserOrignal = this.sequelize.define('user', {}),
      TaskOrignal = this.sequelize.define('task', {});

    UserOrignal.hasMany(TaskOrignal, { as: { singular: 'task', plural: 'taskz'} });

    const ctx1 = new Context('ctx1');
    const User = UserOrignal.contextify(ctx1);
    const Task = TaskOrignal.contextify(ctx1);

    return this.sequelize.sync({ force: true }).then(() => {
      return User.create({ id: 1 });
    }).then(user => {
      expect(user.ctx.value).to.equal('ctx1');
      expect(user.getTaskz).to.be.ok;
      expect(user.addTask).to.be.ok;
      expect(user.addTaskz).to.be.ok;
      return Promise.all([
        user.createTask(),
        user.createTask()
      ]);
    }).then(() => {
      return User.find({ where: { id: 1 }, include: [{model: Task, as: 'taskz'}] });
    }).then(user => {
      expect(user.ctx.value).to.equal('ctx1');
      expect(user.taskz).to.be.ok;
      expect(user.taskz.length).to.equal(2);
      expect(user.taskz[0].ctx).to.be.ok;
      expect(user.taskz[0].ctx.value).to.equal('ctx1');
      expect(user.taskz[1].ctx).to.be.ok;
      expect(user.taskz[1].ctx.value).to.equal('ctx1');
    });
  });

  it('should allow me to define plural and singular forms on the model', function() {
    const User_ = this.sequelize.define('user', {}),
      Task_ = this.sequelize.define('task', {}, {
        name: {
          singular: 'assignment',
          plural: 'assignments'
        }
      });

    User_.hasMany(Task_);

    const ctx1 = new Context('ctx1');
    const User = User_.contextify(ctx1);
    const Task = Task_.contextify(ctx1);

    return this.sequelize.sync({ force: true }).then(() => {
      return User.create({ id: 1 });
    }).then(user => {
      expect(user.ctx.value).to.equal('ctx1');
      expect(user.getAssignments).to.be.ok;
      expect(user.addAssignment).to.be.ok;
      expect(user.addAssignments).to.be.ok;
      return Promise.all([
        user.createAssignment(),
        user.createAssignment()
      ]);
    }).then(() => {
      return User.find({ where: { id: 1 }, include: [Task] });
    }).then(user => {
      expect(user.ctx.value).to.equal('ctx1');
      expect(user.assignments).to.be.ok;
      expect(user.assignments.length).to.equal(2);
      expect(user.assignments[0].ctx).to.equal(ctx1);
      expect(user.assignments[1].ctx).to.equal(ctx1);
    });
  });
});
