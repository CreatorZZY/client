const config = require("../../config.js");
const helpers = require("../../src/shared/doc-helpers.js");

describe('User Signup Flow', () => {
  let testEmail = 'cypress@testing.com'
  let testUserDb = 'userdb-' + helpers.toHex(testEmail.toLowerCase());

  before(() => {
    cy.deleteUser(testEmail)
  })

  beforeEach(() => {
    Cypress.Cookies.preserveOnce('AuthSession')
  })

  it('Can signup using form', () => {
    // Redirects to /signup
    cy.visit(config.TEST_SERVER)
    cy.location('pathname').should('eq', '/signup')

    // Is focused on the first field
    cy.get('#signup-email').should('have.focus')

    // Displays errors on submitting empty form
    cy.get('button.cta')
      .click()

    cy.contains('Please enter an email address')
    cy.contains('Please enter a password')

    // Creates a new account
    cy.get('#signup-email')
      .type(testEmail.toUpperCase())

    cy.get('#signup-password')
      .type('testing')

    cy.get('#email-optin')
      .click()

    cy.get('button.cta')
      .click()

    // Has an AuthSession cookie
    cy.get('button.cta').should('not.exist')
    cy.getCookie('AuthSession').should('exist')

    // Has a user database
    cy.request({url: config.TEST_SERVER + '/db/' + testUserDb, retryOnStatusCodeFailure: true})

    // Imports "Welcome Tree"
    cy.url().should('match', /\/[a-zA-Z0-9]{5}$/)
    cy.contains('Welcome to Gingko Writer')

    // Has email verification banner
    cy.get('#email-confirm-banner')
      .contains('Please confirm your email')

    cy.visit(config.TEST_SERVER + '/confirm')

    // Redirected to welcome, Confirmation banner gone
    cy.url().should('match', /\/[a-zA-Z0-9]{5}$/)
    cy.contains('Welcome to Gingko Writer')

    cy.get('#email-confirm-banner')
      .should('not.exist')

    // Send email confirmation webhook before logging out
    cy.request('POST', config.TEST_SERVER + '/mlhooks',
      {events: [{data: {subscriber: {email: testEmail, confirmation_timestamp: (new Date()).toISOString()}}}]}
    ).as('mlhook')

    cy.waitFor('@mlhook')

    // Logs Out Correctly
    cy.intercept('/logout').as('logoutRequest')
    cy.get('#account-icon').click()
    cy.get('#account-menu')
    cy.get('#logout-button').click()
    cy.wait('@logoutRequest')
    cy.getCookie('AuthSession').should('have.property', 'value', '')
    expect(localStorage.getItem("gingko-session-storage")).to.be.null;
    cy.location('pathname').should('eq', '/login')
    cy.get('button.cta').contains('Login')
  })

  it('Logs in with form', () =>{
    cy.visit(config.TEST_SERVER)

    cy.get('a').contains('Login')
      .click()

    cy.location('pathname').should('eq', '/login')

    cy.get('#email-input')
      .type(testEmail)

    cy.get('#password-input')
      .type('testing')

    cy.get('button.cta')
      .click()

    cy.url().should('not.contain', '/login')
    cy.url().should('match', /\/[a-zA-Z0-9]{5}$/)
    cy.contains('Welcome to Gingko Writer')

    // Doesn't have confirmation banner
    cy.get('#email-confirm-banner')
      .should('not.exist')

    // Has an AuthSession cookie
    cy.get('button.cta').should('not.exist')
    cy.getCookie('AuthSession').should('exist')

    // Has a user database
    cy.wait(2000)
    cy.request({url: config.TEST_SERVER + '/db/' + testUserDb, retryOnStatusCodeFailure: true})

  })

  it('Redirects to login on expired cookie', ()=>{
    cy.login(testEmail)
      .then(()=>{
        cy.clearCookie('AuthSession')
        cy.visit(config.TEST_SERVER)
        cy.location('pathname').should('eq', '/login')
      })
  })

  it('Forgot Password works', () => {
    cy.visit(config.TEST_SERVER+'/login')

    cy.get('a.forgot-password').then(($el) => {
        expect($el.attr('href')).to.eq('/forgot-password')
      })
      .click()

    cy.url().should('contain', '/forgot-password')

    cy.get('input[type=email]')
      .focus()
      .type(testEmail)

    cy.get('button.cta')
      .click()

    cy.contains('Reset Email Sent')
  })
})
