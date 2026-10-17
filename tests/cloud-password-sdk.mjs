import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'
const id = '11111111-1111-4111-8111-111111111111'
const user = { id, aud:'authenticated', email:'owner@example.com', app_metadata:{},user_metadata:{},created_at:new Date().toISOString() }
const payload=Buffer.from(JSON.stringify({sub:id,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')
const token=`eyJhbGciOiJIUzI1NiJ9.${payload}.test`
const paths=[]
const password='synthetic-test-password'
const client=createClient('https://example.supabase.co','sb_publishable_test',{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:async (input,init={}) => {
  const url=new URL(typeof input==='string'?input:input.url);paths.push(url.pathname)
  if(url.pathname==='/auth/v1/user') {
    if(init.method==='PUT') {
      const body=JSON.parse(init.body)
      assert.equal(body.password,password)
      assert.equal(body.email,undefined,'Password setup must not change the identity email')
    }
    return new Response(JSON.stringify(user),{headers:{'content-type':'application/json'}})
  }
  if(url.pathname==='/auth/v1/token') {
    assert.equal(url.searchParams.get('grant_type'),'password')
    assert.equal(JSON.parse(init.body).password,password)
    return new Response(JSON.stringify({access_token:token,refresh_token:'test',token_type:'bearer',expires_in:3600,user}),{headers:{'content-type':'application/json'}})
  }
  throw new Error('Unexpected auth endpoint')
}}})
assert.equal((await client.auth.setSession({access_token:token,refresh_token:'test'})).error,null)
const changed=await client.auth.updateUser({password})
assert.equal(changed.error,null);assert.equal(changed.data.user.id,id)
const signed=await client.auth.signInWithPassword({email:user.email,password})
assert.equal(signed.error,null);assert.equal(signed.data.user.id,id)
assert.ok(paths.every(path=>!path.includes('/otp')&&!path.includes('/signup')),'Password flow sends no email and creates no replacement customer account')
assert.ok(!JSON.stringify(signed.data.session).includes(password),'Password is not persisted in session')
console.log('PASS: real SDK password update/sign-in preserve owner ID, no email endpoint, no password in session')
