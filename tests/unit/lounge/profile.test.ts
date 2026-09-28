import {describe, expect, it} from 'vitest';
import {parseLoungeProfile, parseNickname} from '../../../src/lounge/domain/profile';
describe('fixed Lounge nickname',()=>{
  it.each(['가나다','ㄱㄴ','ㅏㅣ','Ab-1.@','@투자자','a1','z'.repeat(20)])('accepts permitted characters: %s',value=>expect(parseNickname(value)).toBe(value));
  it.each(['a','', 'z'.repeat(21), '가 나',' 가나다','가나다 ', 'abc\n', 'abc\r', 'a\tb', 'a_b','@.-','투자😊','a/b','a\\b','a+b','A＠B','a\u200bb',null,1,{}])('rejects invalid nicknames: %s',value=>expect(parseNickname(value)).toBeNull());
  it('normalizes Korean composition while never silently trimming spaces',()=>{
    expect(parseNickname('가나다'.normalize('NFD'))).toBe('가나다');
    expect(parseNickname(' 가나다 ')).toBeNull();
  });
  it('accepts only the nickname field in a profile',()=>{
    expect(parseLoungeProfile({nickname:'투자자'})).toEqual({nickname:'투자자'});
    for(const value of [{nickname:'투자자',user_id:'secret'},{nickname:'x'},{nickname:'투자자',email:'x@y.z'},null,[]]) expect(parseLoungeProfile(value)).toBeNull();
  });
});
