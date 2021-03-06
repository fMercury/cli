import { expect } from 'chai'
import { sandbox } from 'sinon'
import { Decentraland } from '../../../src/lib/Decentraland'

import { Ethereum } from '../../../src/lib/Ethereum'
import { Project } from '../../../src/lib/Project'
import { IPFS } from '../../../src/lib/IPFS'

import * as ProjectUtils from '../../../src/utils/project'

const ctx = sandbox.create()

/**
 * Why these tests are cool:
 * - We test the order in which methods are called, which is actually part of the business logic
 * - We test the arguments which are passed to the methods, which verifies the data flow
 * - Everything is mocked and test only cover the purposed mentioned above
 *
 * But integration tests!
 *
 * Integration tests are awesome but they lack the granularity to validate each one of the steps.
 * They are black box tests and they are simply not enough. That being said, these tests are only
 * useful when used along black-box integration tests, so keep an eye on those!
 */

describe('Decentraland', () => {
  let getIPNSStub
  let validateExistingProjectStub
  let getParcelCoordinatesStub
  let getProjectFileStub
  let writeProjectFileStub
  let getFilesStub
  let genIPFSKeyStub
  let publishStub
  let addFilesStub
  let linkStub
  let pinStub

  const addFilesResult = beforeEach(() => {
    // Ethereum stubs
    getIPNSStub = ctx.stub(Ethereum.prototype, 'getIPNS').callsFake(() => 'Qmwasd')

    // Project stubs
    validateExistingProjectStub = ctx.stub(Project.prototype, 'validateExistingProject').callsFake(() => undefined)
    getParcelCoordinatesStub = ctx.stub(Project.prototype, 'getParcelCoordinates').callsFake(() => ({ x: 0, y: 0 }))
    getProjectFileStub = ctx.stub(Project.prototype, 'getProjectFile').callsFake(() => ({ id: 'projectId' }))
    writeProjectFileStub = ctx.stub(Project.prototype, 'writeProjectFile').callsFake(() => undefined)
    getFilesStub = ctx.stub(Project.prototype, 'getFiles').callsFake(() => [{ path: '/tmp/myFile.txt', content: null }])

    // IPFS stubs
    genIPFSKeyStub = ctx.stub(IPFS.prototype, 'genIPFSKey').callsFake(() => 'Qmwqwe')
    publishStub = ctx.stub(IPFS.prototype, 'publish').callsFake(() => 'QmIPNS')
    addFilesStub = ctx.stub(IPFS.prototype, 'addFiles').callsFake(() => [{ path: '/tmp/myfile.txt', hash: 'QmHash', size: 123 }])

    // Decentraland stubs
    linkStub = ctx.stub(Decentraland.prototype, 'link').callsFake(() => null)
    pinStub = ctx.stub(Decentraland.prototype, 'pin').callsFake(() => null)

    // Utils stub
    var stub = ctx.stub(ProjectUtils, 'getRootPath').callsFake(() => '.')
  })

  afterEach(() => {
    // completely restore all fakes created through the sandbox
    ctx.restore()
  })

  describe('deploy()', () => {
    it('should call all the necessary APIs', async () => {
      const dcl = new Decentraland()
      const files = await dcl.project.getFiles()
      await dcl.deploy(files)

      expect(getIPNSStub.withArgs({ x: 0, y: 0 }).called, 'expect Ethereum.getIPNS() to be called').to.be.true
      expect(getFilesStub.called, 'expect Project.getFiles() to be called').to.be.true
      expect(getParcelCoordinatesStub.called, 'expect Project.getParcelCoordinates() to be called').to.be.true
      expect(getProjectFileStub.called, 'expect Project.getProjectFile to be called').to.be.true
      expect(
        addFilesStub.withArgs([{ path: '/tmp/myFile.txt', content: null }]).calledBefore(genIPFSKeyStub),
        'expect IPFS.addFiles() to be called'
      ).to.be.true
      expect(genIPFSKeyStub.withArgs('projectId').calledBefore(writeProjectFileStub), 'expect IPFS.genIPFSKey() to be called').to.be.true
      expect(writeProjectFileStub.withArgs({ ipfsKey: 'Qmwqwe' }).calledBefore(publishStub), 'expect Project.writeProjectFile to be called')
        .to.be.true
      expect(publishStub.withArgs('projectId', `/ipfs/QmHash`).calledBefore(linkStub), 'expect IPFS.publish() to be called').to.be.true
      expect(linkStub.calledBefore(pinStub), 'expect Decentraland.link() to be called').to.be.true
      expect(pinStub.called, 'expect Decentraland.pin() to be called').to.be.true
    })

    it('should skip generating a new IPFS key if one is already available', async () => {
      getProjectFileStub.callsFake(() => ({
        id: 'projectId',
        ipfsKey: 'QmExists'
      }))
      const dcl = new Decentraland()
      const files = await dcl.project.getFiles()
      await dcl.deploy(files)

      expect(getIPNSStub.withArgs({ x: 0, y: 0 }).called, 'expect Ethereum.getIPNS() to be called').to.be.true
      expect(getFilesStub.called, 'expect Project.getFiles() to be called').to.be.true
      expect(getParcelCoordinatesStub.called, 'expect Project.getParcelCoordinates() to be called').to.be.true
      expect(getProjectFileStub.called, 'expect Project.getProjectFile to be called').to.be.true
      expect(
        addFilesStub.withArgs([{ path: '/tmp/myFile.txt', content: null }]).calledBefore(publishStub),
        'expect IPFS.addFiles() to be called'
      ).to.be.true
      expect(publishStub.withArgs('projectId', `/ipfs/QmHash`).calledBefore(linkStub), 'expect IPFS.publish() to be called').to.be.true
      expect(linkStub.calledBefore(pinStub), 'expect Decentraland.link() to be called').to.be.true
      expect(pinStub.called, 'expect Decentraland.pin() to be called').to.be.true
      expect(genIPFSKeyStub.notCalled, 'expect IPFS.genIPFSKey() not to be called').to.be.true
    })

    it('should skip pinning when the local IPFS equals the one in the blockchain', async () => {
      getProjectFileStub.callsFake(() => ({
        id: 'projectId',
        ipfsKey: 'Qmwasd'
      }))
      const dcl = new Decentraland()
      const files = await dcl.project.getFiles()
      await dcl.deploy(files)

      expect(getIPNSStub.called, 'expect Ethereum.getIPNS() to be called').to.be.true
      expect(getFilesStub.called, 'expect Project.getFiles() to be called').to.be.true
      expect(getParcelCoordinatesStub.called, 'expect Project.getParcelCoordinates() to be called').to.be.true
      expect(getProjectFileStub.called, 'expect Project.getProjectFile to be called').to.be.true
      expect(
        addFilesStub.withArgs([{ path: '/tmp/myFile.txt', content: null }]).calledBefore(publishStub),
        'expect IPFS.addFiles() to be called'
      ).to.be.true
      expect(publishStub.withArgs('projectId', `/ipfs/QmHash`).calledBefore(pinStub), 'expect IPFS.publish() to be called').to.be.true
      expect(pinStub.called, 'expect Decentraland.pin() to be called').to.be.true
      expect(linkStub.notCalled, 'expect Decentraland.link() not to be called').to.be.true
      expect(genIPFSKeyStub.notCalled, 'expect IPFS.genIPFSKey() not to be called').to.be.true
    })
  })
})
