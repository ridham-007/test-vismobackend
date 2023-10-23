"use strict";

module.exports = [
  {
    method: "GET",
    path: "/users/:id",
    handler: "user.findOne",
    config: {
      policies: [],
      prefix: '',
    },
  },
  {
    method: 'PUT',
    path: '/users/:id',
    handler: 'user.update',
    config: {
      policies: [],
      prefix: '',
    },
  },
];
