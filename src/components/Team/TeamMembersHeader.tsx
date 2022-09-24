import { Competition, Team } from "../../domain/leaderboard/types";
import "./TeamMembersHeader.css";
import { CHAIN_ID_QUERY_PARAM, helperToast, shortenAddress, useChainId } from "../../lib/legacy";
import { getTeamUrl } from "../../domain/leaderboard/urls";
import { useCopyToClipboard } from "react-use";
import useRouteQuery from "../../lib/useRouteQuery";
import Modal from "../Modal/Modal";
import { useEffect, useRef, useState } from "react";
import { useWeb3React } from "@web3-react/core";
import { ethers } from "ethers";
import { approveJoinRequest, cancelJoinRequest, createJoinRequest, getAccountJoinRequest, removeMember, useAccountJoinRequest, useMemberTeam } from "../../domain/leaderboard/contracts";
import { FiX } from "react-icons/fi";

type Inviteprops = {
  team: Team,
}

function Invite({ team }: Inviteprops) {
  const { chainId } = useChainId()
  const query = useRouteQuery()
  const [,copyToClipboard] = useCopyToClipboard()

  const referralLink = () => {
    let link = new URL(window.location.host).toString() + "/#" + getTeamUrl(team.leaderAddress)
    link += `?${CHAIN_ID_QUERY_PARAM}=${chainId}`
    if (query.has("referral") && query.get("referral") !== "") {
      link += "&referral=" + query.get("referral")
    }
    return link
  }

  const copyInviteLink = () => {
    copyToClipboard(referralLink())
    helperToast.success("Invite link copied to clipboard!")
  }

  return (
    <button className="App-button-option" onClick={copyInviteLink}>
      Copy Invite Link
    </button>
  )
}

type ApproveProps = {
  team: Team,
  pendingTxns: any,
  setPendingTxns: any,
  onApprove: () => any,
  competition: Competition,
}

function Approve({ competition, onApprove, team, pendingTxns, setPendingTxns }: ApproveProps) {
  const { chainId, library, account } = useWeb3React()
  const [value, setValue] = useState("")
  const [open, setOpen] = useState(false)
  const [inputError, setInputError] = useState("")
  const [isChecking, setIsChecking] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [addresses, setAddressess] = useState<string[]>([])
  const addressInputRef = useRef<HTMLInputElement>(null)

  const hasMembersOverload = () => {
    return team.members.length + addresses.length >= competition.maxTeamSize
  }

  useEffect(() => {
    async function main() {
      setIsChecking(true)

      if (value === "") {
        setInputError("")
        setIsChecking(false)
        return
      }

      if (!ethers.utils.isAddress(value)) {
        setInputError("Enter a valid address")
        setIsChecking(false)
        return
      }

      const joinRequest = await getAccountJoinRequest(chainId, library, team.competitionIndex, ethers.utils.getAddress(value))
      if (joinRequest === null) {
        setInputError("Account did not apply")
        setIsChecking(false)
        return
      }

      if (joinRequest.leaderAddress !== team.leaderAddress) {
        setInputError("Account did not apply")
        setIsChecking(false)
        return
      }

      if (addresses.indexOf(value) !== -1) {
        setInputError("Already added to the list")
        setIsChecking(false)
        return
      }

      setInputError("")
      setIsChecking(false)
    }

    main()
  }, [account, chainId, library, team.competitionIndex, value, team.leaderAddress, addresses])

  const getMainButtonText = () => {
    if (hasMembersOverload()) {
      return "Max team size reached"
    }

    if (value === "") {
      return "Enter member address"
    }

    if (isChecking) {
      return "Checking address..."
    }

    if (inputError) {
      return inputError
    }

    return "Add member address"
  }

  const handleInput = ({ target }) => {
    setValue(target.value.trim())
  }

  const handleAddAddressClick = () => {
    setAddressess(addrs => [...addrs, value])
    setValue("")
    addressInputRef.current?.focus()
  }

  const handleRemoveAddress = (addr) => {
    setAddressess(addrs => addrs.filter(a => a !== addr))
  }

  const handleModalChange = () => {
    if (open) {
      addressInputRef.current?.focus()
    } else {
      setAddressess([])
      setValue("")
    }
  }

  const sendTransaction = async () => {
    setProcessing(true)

    try {
      const tx = await approveJoinRequest(chainId, library, team.competitionIndex, addresses, {
        successMsg: "User approved!",
        sentMsg: "User approval submitted!",
        failMsg: "User approval failed.",
        pendingTxns,
        setPendingTxns,
      })

      const receipt = await tx.wait()

      if (receipt.status === 1) {
        setOpen(false)
        setValue("")
        setAddressess([])
        onApprove()
      }
    } catch (err) {
      console.error(err)
    } finally {
      setProcessing(false)
    }
  }

  return (
    <>
      <button className="App-button-option" disabled={processing} onClick={() => setOpen(true)}>
        {processing ? "Approving..." : "Approve members"}
      </button>
      <Modal onAfterOpen={handleModalChange} label="Approve members" isVisible={open} setIsVisible={setOpen}>
        <div className="team-modal-content">
          <p>Lorem ipsum dolor, sit amet consectetur adipisicing elit.</p>
          {addresses.length > 0 && (
            <ul className="approve-address-list">
              {addresses.map(address => (
                <li key={address}>
                  <span>{shortenAddress(address, 10)}</span>
                  <FiX size={16} title="Remove address" onClick={() => handleRemoveAddress(address)}/>
                </li>
              ))}
            </ul>
          )}
          {!hasMembersOverload() && (
            <input ref={addressInputRef} disabled={processing} placeholder="Member address" className="text-input text-input-approve" type="text" value={value} onInput={handleInput}/>
          )}
          <div className="divider"></div>
          <div className="App-card-options App-card-options-right">
            {addresses.length > 0 && (
              <button onClick={() => sendTransaction()} disabled={processing} className="default-btn App-card-option">{processing ? "Approving..." : "Approve members"}</button>
            )}
            {!processing && (value.length > 0 || addresses.length === 0) && (
              <button
                className={"App-card-option " + (addresses.length > 0 ? "App-button-option" : "default-btn")}
                disabled={value === "" || inputError || processing ? true : false}
                onClick={() => handleAddAddressClick()}
              >
                {getMainButtonText()}
              </button>
            )}
          </div>
        </div>
      </Modal>
    </>
  )
}

type CreateJoinRequestProps = {
  team: Team,
  pendingTxns: any,
  setPendingTxns: any,
  onCreate: () => any,
}

function CreateJoinRequest({ team, pendingTxns, setPendingTxns, onCreate }: CreateJoinRequestProps) {
  const { chainId, library } = useWeb3React()
  const query = useRouteQuery()
  const [open, setOpen] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [referralCode, setReferralCode] = useState("")

  useEffect(() => {
    const code = query.get("referral")
    if (code !== null && code !== "") {
      setReferralCode(code)
    }
  }, [query])

  const handleButtonClick = () => {
    if (referralCode === "") {
      return sendTransaction()
    }

    setOpen(true)
  }

  const sendTransaction = async () => {
    setProcessing(true)

    try {
      const tx = await createJoinRequest(chainId, library, team.competitionIndex, team.leaderAddress, referralCode, {
        successMsg: "Join request created!",
        sentMsg: "Join request submitted!",
        failMsg: "Join request failed.",
        pendingTxns,
        setPendingTxns,
      })

      const receipt = await tx.wait()

      if (receipt.status === 1) {
        onCreate()
      }
    } catch (err) {
      console.error(err)
    } finally {
      setProcessing(false)
    }
  }

  return (
    <>
      <button className="App-button-option" disabled={processing} onClick={() => handleButtonClick()}>
        {processing ? "Creating join request..." : "Create join request"}
      </button>
      <Modal label="Create Join Request" isVisible={open} setIsVisible={setOpen}>
        <div className="team-modal-content">
          <p>By creating this join request you accept to use the team leader's referral code: </p>
          <p className="team-modal-referral-code">{referralCode}</p>
          <div className="divider"></div>
          <button className="default-btn" onClick={sendTransaction} disabled={processing}>
            {processing ? "Creating join request..." : "Create join request"}
          </button>
        </div>
      </Modal>
    </>
  )
}

type CancelJoinRequestProps = {
  team: Team,
  pendingTxns: any,
  setPendingTxns: any,
  onCancel: () => any,
}

function CancelJoinRequest({ team, pendingTxns, setPendingTxns, onCancel }: CancelJoinRequestProps) {
  const { chainId, library } = useWeb3React()
  const [processing, setProcessing] = useState(false)

  const sendTransaction = async () => {
    setProcessing(true)

    try {
      const tx = await cancelJoinRequest(chainId, library, team.competitionIndex, {
        successMsg: "Join request canceled!",
        sentMsg: "Join request cancelation submitted!",
        failMsg: "Join request cancelation failed.",
        pendingTxns,
        setPendingTxns,
      })

      const receipt = await tx.wait()

      if (receipt.status === 1) {
        onCancel()
      }
    } catch (err) {
      console.error(err)
    } finally {
      setProcessing(false)
    }
  }

  return (
    <button className="App-button-option" onClick={() => sendTransaction()} disabled={processing}>
      {processing ? "Canceling join request..." : "Cancel join request"}
    </button>
  )
}


type QuitTeamButtonProps = {
  team: Team,
  pendingTxns: any,
  setPendingTxns: any,
  onQuit: () => any,
}

function QuitTeamButton({ team, pendingTxns, setPendingTxns, onQuit }: QuitTeamButtonProps) {
  const { chainId, library, account } = useWeb3React()
  const [processing, setProcessing] = useState(false)

  const sendTransaction = async () => {
    setProcessing(true)

    try {
      const tx = await removeMember(chainId, library, team.competitionIndex, team.leaderAddress, account, {
        successMsg: "Success!",
        sentMsg: "Transaction submitted!",
        failMsg: "Transaction failed.",
        pendingTxns,
        setPendingTxns,
      })

      const receipt = await tx.wait()

      if (receipt.status === 1) {
        onQuit()
      }
    } catch (err) {
      console.error(err)
    } finally {
      setProcessing(false)
    }
  }

  return (
    <button className="transparent-btn" disabled={processing} onClick={() => sendTransaction()}>
      {processing ? "Leaving team..." : "Leave team"}
    </button>
  )
}

type TeamMemberHeaderProps = {
  competition: Competition,
  team: Team,
  pendingTxns: any,
  setPendingTxns: any,
  onMembersChange: () => any,
}

export default function TeamMembersHeader({ competition, onMembersChange, team, pendingTxns, setPendingTxns }: TeamMemberHeaderProps) {
  const { chainId, library, account } = useWeb3React()

  const {
    exists: hasJoinRequest,
    loading: accountJoinRequestLoading,
    revalidate: revalidateJoinRequest
  } = useAccountJoinRequest(chainId, library, team.competitionIndex, account)

  const {
    data: memberTeam,
    loading: memberTeamLoading,
    revalidate: revalidateMemberTeam
  } = useMemberTeam(chainId, library, team.competitionIndex, account)

  const isLeader = () => account === team.leaderAddress
  const isMember = () => memberTeam === team.leaderAddress

  const onQuit = () => {
    revalidateMemberTeam()
    onMembersChange()
  }

  if (memberTeamLoading || accountJoinRequestLoading) {
    return <></>
  }

  return (
    <div className="simple-table-top-header simple-table-top-header-right">
      {isLeader() && team.members.length < competition.maxTeamSize && (
        <>
          <Invite team={team}/>
          <Approve competition={competition} team={team} pendingTxns={pendingTxns} setPendingTxns={setPendingTxns} onApprove={onMembersChange} />
        </>
      )}

      {!isLeader() && (
        <>
          {!isMember() && !hasJoinRequest && <CreateJoinRequest onCreate={revalidateJoinRequest} team={team} setPendingTxns={setPendingTxns} pendingTxns={pendingTxns}/>}
          {!isMember() && hasJoinRequest && <CancelJoinRequest onCancel={revalidateJoinRequest} team={team} setPendingTxns={setPendingTxns} pendingTxns={pendingTxns}/>}
          {isMember() && <QuitTeamButton team={team} onQuit={onQuit} setPendingTxns={setPendingTxns} pendingTxns={pendingTxns}/>}
        </>
      )}
    </div>
  )
}