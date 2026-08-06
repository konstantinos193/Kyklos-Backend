// Every guarded route, checked against three hostile callers: anonymous, a
// garbage token, and a valid *student* token used against admin-only routes.
import { test, describe } from 'node:test';
import { api, expectOneOf, studentSession } from './helpers.mjs';

const ADMIN_ONLY = [
  ['GET', '/api/admin/admins'],
  ['POST', '/api/admin/admins'],
  ['GET', '/api/admin/settings'],
  ['PUT', '/api/admin/settings'],
  ['GET', '/api/admin/stats'],
  ['GET', '/api/admin/students'],
  ['POST', '/api/admin/students'],
  ['GET', '/api/admin/teachers'],
  ['POST', '/api/blog'],
  ['POST', '/api/news'],
  ['GET', '/api/exam-materials/admin'],
  ['GET', '/api/exam-materials/admin/list'],
  ['POST', '/api/exam-materials'],
  ['GET', '/api/exercises/teacher'],
  ['POST', '/api/exercises/teacher'],
  ['GET', '/api/newsletter/stats'],
  ['GET', '/api/newsletter/subscribers'],
  ['GET', '/api/newsletter/export'],
  ['POST', '/api/newsletter/send'],
  ['POST', '/api/panhellenic-archive'],
  ['GET', '/api/teacher-permissions'],
  ['POST', '/api/teacher-permissions'],
];

const STUDENT_ONLY = [
  ['GET', '/api/exam-materials'],
  ['GET', '/api/exercises/student'],
];

describe('Authorization: anonymous callers are refused', () => {
  for (const [method, path] of [...ADMIN_ONLY, ...STUDENT_ONLY]) {
    test(`${method} ${path} rejects anonymous`, async () => {
      const res = await api(path, { method, body: method === 'GET' ? undefined : {} });
      expectOneOf(res, [401, 403], `${method} ${path} anonymous`);
    });
  }
});

describe('Authorization: forged tokens are refused', () => {
  for (const [method, path] of [...ADMIN_ONLY, ...STUDENT_ONLY]) {
    test(`${method} ${path} rejects a garbage token`, async () => {
      const res = await api(path, { method, token: 'not.a.real.token', body: method === 'GET' ? undefined : {} });
      expectOneOf(res, [401, 403], `${method} ${path} garbage token`);
    });
  }
});

describe('Authorization: privilege separation', () => {
  let student;
  test('set up a student session', async () => {
    student = await studentSession();
  });

  for (const [method, path] of ADMIN_ONLY) {
    test(`${method} ${path} rejects a student token`, async (t) => {
      if (!student) return t.skip('no student session');
      const res = await api(path, { method, token: student.token, body: method === 'GET' ? undefined : {} });
      expectOneOf(res, [401, 403], `${method} ${path} with student token must not be admin-accessible`);
    });
  }
});
