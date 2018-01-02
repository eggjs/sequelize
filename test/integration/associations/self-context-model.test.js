'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require(__dirname + '/../support'),
  DataTypes = require(__dirname + '/../../../lib/data-types'),
  Sequelize = require(__dirname + '/../../../index'),
  Promise = Sequelize.Promise,
  _ = require('lodash');

describe(Support.getTestDialectTeaser('Self on ContextModel'), () => {
  class Context {
    constructor(val) {
      this.value = val;
    }
  }

  it('supports freezeTableName', function() {
    const Group_ = this.sequelize.define('Group', {}, {
      tableName: 'user_group',
      timestamps: false,
      underscored: true,
      freezeTableName: true
    });
    Group_.belongsTo(Group_, { as: 'Parent', foreignKey: 'parent_id' });

    const ctx1 = new Context('ctx1');
    const Group = Group_.contextify(ctx1);

    return Group.sync({force: true}).then(() => {
      return Group.findAll({
        include: [{
          model: Group,
          as: 'Parent'
        }]
      });
    }).then(rs => {
      expect(rs.length).to.equal(0);
    });
  });

  it('can handle 1:m associations', function() {
    const Person_ = this.sequelize.define('Person', { name: DataTypes.STRING });
    Person_.hasMany(Person_, { as: 'Children', foreignKey: 'parent_id'});

    const ctx1 = new Context('ctx1');
    const Person = Person_.contextify(ctx1);

    expect(Person.rawAttributes.parent_id).to.be.ok;

    return this.sequelize.sync({force: true}).then(() => {
      return Promise.all([
        Person.create({ name: 'Mary' }),
        Person.create({ name: 'John' }),
        Person.create({ name: 'Chris' })
      ]);
    }).spread((mary, john, chris) => {
      expect(mary.ctx).to.equal(ctx1);
      expect(john.ctx).to.equal(ctx1);
      expect(chris.ctx).to.equal(ctx1);
      return mary.setChildren([john, chris]);
    });
  });

  it('can handle n:m associations', function() {
    const self = this;

    const Person_ = this.sequelize.define('Person', { name: DataTypes.STRING });

    Person_.belongsToMany(Person_, { as: 'Parents', through: 'Family', foreignKey: 'ChildId', otherKey: 'PersonId' });
    Person_.belongsToMany(Person_, { as: 'Childs', through: 'Family', foreignKey: 'PersonId', otherKey: 'ChildId' });

    const ctx1 = new Context('ctx1');
    const Person = Person_.contextify(ctx1);

    const foreignIdentifiers = _.map(_.values(Person.associations), 'foreignIdentifier');
    const rawAttributes = _.keys(this.sequelize.models.Family.rawAttributes);

    expect(foreignIdentifiers.length).to.equal(2);
    expect(rawAttributes.length).to.equal(4);

    expect(foreignIdentifiers).to.have.members(['PersonId', 'ChildId']);
    expect(rawAttributes).to.have.members(['createdAt', 'updatedAt', 'PersonId', 'ChildId']);

    return this.sequelize.sync({ force: true }).then(() => {
      return self.sequelize.Promise.all([
        Person.create({ name: 'Mary' }),
        Person.create({ name: 'John' }),
        Person.create({ name: 'Chris' })
      ]).spread((mary, john, chris) => {
        expect(mary.ctx).to.equal(ctx1);
        expect(john.ctx).to.equal(ctx1);
        expect(chris.ctx).to.equal(ctx1);

        return mary.setParents([john]).then(() => {
          return chris.addParent(john);
        }).then(() => {
          return john.getChilds();
        }).then(children => {
          expect(_.map(children, 'id')).to.have.members([mary.id, chris.id]);
          for (const child of children) {
            expect(child.ctx).to.equal(ctx1);
          }
        });
      });
    });
  });

  it('can handle n:m associations with pre-defined through table', function() {
    const Person_ = this.sequelize.define('Person', { name: DataTypes.STRING });
    const Family_ = this.sequelize.define('Family', {
      preexisting_child: {
        type: DataTypes.INTEGER,
        primaryKey: true
      },
      preexisting_parent: {
        type: DataTypes.INTEGER,
        primaryKey: true
      }
    }, { timestamps: false });

    Person_.belongsToMany(Person_, { as: 'Parents', through: Family_, foreignKey: 'preexisting_child', otherKey: 'preexisting_parent' });
    Person_.belongsToMany(Person_, { as: 'Children', through: Family_, foreignKey: 'preexisting_parent', otherKey: 'preexisting_child' });

    const ctx1 = new Context('ctx1');
    const Person = Person_.contextify(ctx1);
    const Family = Family_.contextify(ctx1);

    const foreignIdentifiers = _.map(_.values(Person.associations), 'foreignIdentifier');
    const rawAttributes = _.keys(Family.rawAttributes);

    expect(foreignIdentifiers.length).to.equal(2);
    expect(rawAttributes.length).to.equal(2);

    expect(foreignIdentifiers).to.have.members(['preexisting_parent', 'preexisting_child']);
    expect(rawAttributes).to.have.members(['preexisting_parent', 'preexisting_child']);

    let count = 0;
    return this.sequelize.sync({ force: true }).bind(this).then(() => {
      return Promise.all([
        Person.create({ name: 'Mary' }),
        Person.create({ name: 'John' }),
        Person.create({ name: 'Chris' })
      ]);
    }).spread(function(mary, john, chris) {
      expect(mary.ctx).to.equal(ctx1);
      expect(john.ctx).to.equal(ctx1);
      expect(chris.ctx).to.equal(ctx1);

      this.mary = mary;
      this.chris = chris;
      this.john = john;
      return mary.setParents([john], {
        logging(sql) {
          if (sql.match(/INSERT/)) {
            count++;
            expect(sql).to.have.string('preexisting_child');
            expect(sql).to.have.string('preexisting_parent');
          }
        }
      });
    }).then(function() {
      return this.mary.addParent(this.chris, {
        logging(sql) {
          if (sql.match(/INSERT/)) {
            count++;
            expect(sql).to.have.string('preexisting_child');
            expect(sql).to.have.string('preexisting_parent');
          }
        }
      });
    }).then(function() {
      return this.john.getChildren({
        logging(sql) {
          count++;
          const whereClause = sql.split('FROM')[1]; // look only in the whereClause
          expect(whereClause).to.have.string('preexisting_child');
          expect(whereClause).to.have.string('preexisting_parent');
        }
      });
    }).then(function(children) {
      expect(count).to.be.equal(3);
      expect(_.map(children, 'id')).to.have.members([this.mary.id]);
      for (const child of children) {
        expect(child.ctx).to.equal(ctx1);
      }
    });
  });
});
